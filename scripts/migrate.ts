/**
 * Migration runner — applies pending SQL migrations to Neon Postgres.
 *
 * Usage:
 *   pnpm migrate                          # reads NEON_DATABASE_URL from env
 *   NEON_DATABASE_URL=<url> pnpm migrate  # inline override
 *
 * For local development, set NEON_DATABASE_URL in .env.local and load it
 * before running:
 *   source .env.local && pnpm migrate
 *   # or: dotenv -e .env.local -- pnpm migrate
 *
 * Uses the Neon serverless HTTP driver — no WebSocket setup needed in Node 22.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'db', 'migrations');

async function run() {
  const url = process.env['NEON_DATABASE_URL'];
  if (!url) {
    console.error('Error: NEON_DATABASE_URL environment variable is not set.');
    console.error(
      'Set it in .env.local and load before running: source .env.local && pnpm migrate',
    );
    process.exit(1);
  }

  const sql = neon(url);

  // Ensure the migrations tracking table exists
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         serial      PRIMARY KEY,
      filename   text        NOT NULL UNIQUE,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  // Read already-applied migrations
  const applied = await sql`SELECT filename FROM _migrations ORDER BY id`;
  const appliedSet = new Set(applied.map((r) => r['filename'] as string));

  // Read migration files in lexicographic order (0001_, 0002_, ...)
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let appliedCount = 0;

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  skip  ${file} (already applied)`);
      continue;
    }

    const filepath = join(MIGRATIONS_DIR, file);
    const sql_text = readFileSync(filepath, 'utf8');

    console.log(`  apply ${file} …`);
    try {
      // Execute the migration SQL (may contain multiple statements)
      await sql.transaction((txSql) => [
        txSql([sql_text] as unknown as TemplateStringsArray),
        txSql`INSERT INTO _migrations (filename) VALUES (${file})`,
      ]);
      appliedCount++;
      console.log(`  done  ${file}`);
    } catch (err) {
      console.error(`  FAIL  ${file}`);
      console.error(err);
      process.exit(1);
    }
  }

  if (appliedCount === 0) {
    console.log('All migrations are already up to date.');
  } else {
    console.log(`\nApplied ${appliedCount} migration(s) successfully.`);
  }
}

run().catch((err) => {
  console.error('Migration runner encountered an unexpected error:', err);
  process.exit(1);
});
