/**
 * Backfill 240×240 WebP thumbnails for existing image_assets rows.
 *
 * ─── DO NOT RUN AGAINST PRODUCTION WITHOUT HUMAN SIGN-OFF ─────────────────
 *
 * This script generates thumbnail variants for any image_assets row where:
 *   - entity_type is one of: item, item_plan, proposal_item, proposal_plan
 *   - thumbnail_r2_key IS NULL (not yet backfilled)
 *   - content_type is NOT image/gif (GIFs are intentionally skipped)
 *
 * Prerequisites:
 *   pnpm add -D @aws-sdk/client-s3 sharp
 *
 * Environment variables (in .env.local or inline):
 *   NEON_DATABASE_URL        — Neon Postgres connection string
 *   R2_ACCOUNT_ID            — Cloudflare account ID
 *   R2_ACCESS_KEY_ID         — R2 access key (from Cloudflare dashboard → R2 → Manage R2 API tokens)
 *   R2_SECRET_ACCESS_KEY     — R2 secret key
 *   R2_BUCKET_NAME           — R2 bucket name (e.g. "ffe-images")
 *
 * Usage (dry-run first):
 *   DRY_RUN=true pnpm tsx scripts/backfill-image-thumbnails.ts
 *   pnpm tsx scripts/backfill-image-thumbnails.ts
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { Pool } from '@neondatabase/serverless';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local') });

const DRY_RUN = process.env['DRY_RUN'] === 'true';
const THUMBNAIL_SIZE = 240;
const THUMBNAIL_ENTITY_TYPES = ['item', 'item_plan', 'proposal_item', 'proposal_plan'] as const;
const BATCH_SIZE = 20;

type ImageRow = {
  id: string;
  r2_key: string;
  content_type: string;
  entity_type: string;
};

function buildThumbR2Key(r2Key: string, imageId: string): string {
  const lastSlash = r2Key.lastIndexOf('/');
  return r2Key.slice(0, lastSlash + 1) + `${imageId}_thumb.webp`;
}

async function generateThumbnail(imageBytes: Buffer): Promise<Buffer> {
  return sharp(imageBytes)
    .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover', position: 'centre' })
    .webp({ quality: 85 })
    .toBuffer();
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks);
}

async function run() {
  const dbUrl = process.env['NEON_DATABASE_URL'];
  const accountId = process.env['R2_ACCOUNT_ID'];
  const accessKeyId = process.env['R2_ACCESS_KEY_ID'];
  const secretAccessKey = process.env['R2_SECRET_ACCESS_KEY'];
  const bucketName = process.env['R2_BUCKET_NAME'];

  if (!dbUrl || !accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    console.error('Missing required environment variables. See script header for details.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  const { rows: images } = await pool.query<ImageRow>(
    `SELECT id, r2_key, content_type, entity_type
     FROM image_assets
     WHERE entity_type = ANY($1)
       AND thumbnail_r2_key IS NULL
       AND content_type != 'image/gif'
     ORDER BY created_at DESC`,
    [THUMBNAIL_ENTITY_TYPES],
  );

  console.log(
    `Found ${images.length} image(s) to backfill.${DRY_RUN ? ' (DRY RUN — no changes will be written)' : ''}`,
  );

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < images.length; i += BATCH_SIZE) {
    const batch = images.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (image) => {
        try {
          // 1. Fetch original from R2
          const getResult = await s3.send(
            new GetObjectCommand({ Bucket: bucketName, Key: image.r2_key }),
          );
          if (!getResult.Body) throw new Error('Empty R2 response');
          const originalBytes = await streamToBuffer(getResult.Body as NodeJS.ReadableStream);

          // 2. Generate thumbnail
          const thumbBytes = await generateThumbnail(originalBytes);
          const thumbKey = buildThumbR2Key(image.r2_key, image.id);

          if (!DRY_RUN) {
            // 3. Upload thumbnail to R2
            await s3.send(
              new PutObjectCommand({
                Bucket: bucketName,
                Key: thumbKey,
                Body: thumbBytes,
                ContentType: 'image/webp',
                CacheControl: 'private, max-age=86400',
                Metadata: { imageId: image.id, variant: 'thumb_240' },
              }),
            );

            // 4. Update DB row
            await pool.query(
              `UPDATE image_assets
               SET thumbnail_r2_key = $1, thumbnail_byte_size = $2
               WHERE id = $3`,
              [thumbKey, thumbBytes.byteLength, image.id],
            );
          }

          console.log(
            `  [${DRY_RUN ? 'dry' : 'ok'}] ${image.id} (${image.entity_type}) → ${thumbKey}`,
          );
          succeeded++;
        } catch (err) {
          console.error(
            `  [fail] ${image.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
          failed++;
        }
      }),
    );
  }

  console.log(`\nDone. succeeded=${succeeded} failed=${failed}`);
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
