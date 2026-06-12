import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const migrationSql = readFileSync(
  resolve(repoRoot, 'db', 'migrations', '0040_plan_documents.sql'),
  'utf8',
);
const normalizedSql = migrationSql.replace(/\s+/g, ' ').trim();

describe('0040 plan document migration', () => {
  it('backfills every legacy measured plan into its own one-sheet document', () => {
    expect(normalizedSql).toContain('CREATE TABLE IF NOT EXISTS plan_documents');
    expect(normalizedSql).toContain('ADD COLUMN IF NOT EXISTS plan_document_id uuid');
    expect(normalizedSql).toContain(
      'ADD COLUMN IF NOT EXISTS sheet_index integer NOT NULL DEFAULT 1',
    );
    expect(normalizedSql).toContain("ADD COLUMN IF NOT EXISTS page_label text NOT NULL DEFAULT ''");

    expect(normalizedSql).toContain('FROM measured_plans mp WHERE mp.plan_document_id IS NULL');
    expect(normalizedSql).toContain('gen_random_uuid() AS document_id');
    expect(normalizedSql).toContain('INSERT INTO plan_documents');
    expect(normalizedSql).toContain(
      "CASE WHEN source_type = 'pdf-page' THEN 'pdf' ELSE 'image' END",
    );
    expect(normalizedSql).toContain(
      "CASE WHEN source_type = 'pdf-page' THEN COALESCE(pdf_r2_key, image_r2_key) ELSE image_r2_key END",
    );
    expect(normalizedSql).toContain('cover_measured_plan_id');
    expect(normalizedSql).toContain('RETURNING id, cover_measured_plan_id');

    expect(normalizedSql).toContain(
      'UPDATE measured_plans mp SET plan_document_id = inserted_documents.id',
    );
    expect(normalizedSql).toContain('sheet_index = 1');
    expect(normalizedSql).toContain("page_label = ''");
    expect(normalizedSql).toContain('WHERE mp.id = inserted_documents.cover_measured_plan_id');
  });

  it('enforces the document relationship after backfill', () => {
    expect(normalizedSql).toContain('ALTER COLUMN plan_document_id SET NOT NULL');
    expect(normalizedSql).toContain(
      'FOREIGN KEY (plan_document_id) REFERENCES plan_documents(id) ON DELETE CASCADE',
    );
    expect(normalizedSql).toContain(
      'FOREIGN KEY (cover_measured_plan_id) REFERENCES measured_plans(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED',
    );
    expect(normalizedSql).toContain(
      'CREATE INDEX IF NOT EXISTS measured_plans_document_idx ON measured_plans(plan_document_id, sheet_index, created_at)',
    );
  });
});
