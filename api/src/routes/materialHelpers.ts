import type { Env } from '../types';
import { getDb } from '../lib/db';

type Sql = ReturnType<typeof getDb>;

/**
 * Returns the next monotonic material_id for import within a project.
 * Reads the highest existing numeric material_id, adds 1.
 * Never backfills gaps — always max + 1.
 */
export async function generateImportMaterialId(sql: Sql, projectId: string): Promise<string> {
  const rows = await sql`
    SELECT COALESCE(
      MAX(CAST(material_id AS int)) FILTER (WHERE material_id ~ '^[0-9]+$'),
      0
    ) AS max_id
    FROM materials
    WHERE project_id = ${projectId}
  `;
  const max = Number((rows[0] as { max_id?: number }).max_id ?? 0);
  return String(max + 1);
}

/**
 * Returns the next "Import N" name for import within a project.
 * Reads the highest existing N from names matching "Import <number>", adds 1.
 * Never backfills gaps — always max + 1.
 */
export async function generateImportName(sql: Sql, projectId: string): Promise<string> {
  const rows = await sql`
    SELECT COALESCE(
      MAX(CAST(SUBSTRING(name FROM '^Import ([0-9]+)$') AS int))
        FILTER (WHERE name ~ '^Import [0-9]+$'),
      0
    ) AS max_n
    FROM materials
    WHERE project_id = ${projectId}
  `;
  const max = Number((rows[0] as { max_n?: number }).max_n ?? 0);
  return `Import ${max + 1}`;
}

export async function selectMaterialById(sql: Sql, materialId: string) {
  const rows = await sql`SELECT * FROM materials WHERE id = ${materialId}`;
  return rows[0];
}

export async function countMaterialReferences(sql: Sql, materialId: string): Promise<number> {
  const rows = await sql`
    SELECT (
      (SELECT COUNT(*) FROM item_materials          WHERE material_id = ${materialId}) +
      (SELECT COUNT(*) FROM takeoff_item_materials  WHERE material_id = ${materialId})
    )::int AS total
  `;
  return Number((rows[0] as { total?: number } | undefined)?.total ?? 0);
}

function extForContentType(ct: string): string {
  switch (ct) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'bin';
  }
}

type ForkPatch = {
  name?: string | undefined;
  material_id?: string | undefined;
  description?: string | undefined;
  swatch_hex?: string | undefined;
};

export async function forkMaterial(
  sql: Sql,
  env: Env,
  uid: string,
  materialId: string,
  patch: ForkPatch,
): Promise<string> {
  const currentRows = await sql`SELECT * FROM materials WHERE id = ${materialId}`;
  const cur = currentRows[0] as {
    id: string;
    project_id: string;
    name: string;
    material_id: string;
    description: string;
    swatch_hex: string;
  };

  const newName = patch.name ?? cur.name;
  const newMatId = patch.material_id ?? cur.material_id;
  const newDesc = patch.description ?? cur.description;
  const newHex = patch.swatch_hex ?? cur.swatch_hex;

  const newRows = await sql`
    INSERT INTO materials (project_id, name, material_id, description, swatch_hex)
    VALUES (${cur.project_id}, ${newName}, ${newMatId}, ${newDesc}, ${newHex})
    RETURNING *
  `;
  const newMat = newRows[0] as { id: string };

  // Copy primary image via R2 streaming copy
  const imgRows = await sql`
    SELECT * FROM image_assets
    WHERE  material_id = ${materialId} AND entity_type = 'material'
    ORDER  BY is_primary DESC
    LIMIT  1
  `;
  const img = imgRows[0] as
    | {
        r2_key: string;
        content_type: string;
        filename: string;
        byte_size: number;
        alt_text: string;
      }
    | undefined;

  if (img) {
    const obj = await env.IMAGES_BUCKET.get(img.r2_key);
    if (obj) {
      const newImgId = crypto.randomUUID();
      const ext = extForContentType(img.content_type);
      const newKey = `users/${uid}/projects/${cur.project_id}/materials/${newMat.id}/${newImgId}.${ext}`;
      await env.IMAGES_BUCKET.put(newKey, obj.body, {
        httpMetadata: { contentType: img.content_type, cacheControl: 'private, max-age=3600' },
        customMetadata: {
          ownerUid: uid,
          projectId: cur.project_id,
          entityType: 'material',
          imageId: newImgId,
          materialId: newMat.id,
          takeoffItemId: '',
        },
      });
      await sql`
        INSERT INTO image_assets (
          id, entity_type, owner_uid, project_id,
          room_id, item_id, material_id, takeoff_item_id,
          r2_key, filename, content_type, byte_size, alt_text, is_primary
        ) VALUES (
          ${newImgId}, 'material', ${uid}, ${cur.project_id},
          null, null, ${newMat.id}, null,
          ${newKey}, ${img.filename}, ${img.content_type}, ${img.byte_size}, ${img.alt_text}, true
        )
      `;
    }
  }

  return newMat.id;
}
