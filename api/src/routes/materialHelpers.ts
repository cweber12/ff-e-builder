import type { Env } from '../types';
import { getDb } from '../lib/db';

type Sql = ReturnType<typeof getDb>;

/**
 * Returns the next monotonic material_id (manufacturer reference) for import within a project.
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
 * Returns the next sequential code for a new material or finish within a project.
 * Reads the highest existing numeric code in the given table, adds 1.
 * Never backfills gaps — always max + 1.
 */
export async function generateNextCode(
  sql: Sql,
  table: 'materials' | 'finishes',
  projectId: string,
): Promise<string> {
  const rows =
    table === 'materials'
      ? await sql`
          SELECT COALESCE(
            MAX(CAST(code AS int)) FILTER (WHERE code ~ '^[0-9]+$'),
            0
          ) AS max_code
          FROM materials
          WHERE project_id = ${projectId}
        `
      : await sql`
          SELECT COALESCE(
            MAX(CAST(code AS int)) FILTER (WHERE code ~ '^[0-9]+$'),
            0
          ) AS max_code
          FROM finishes
          WHERE project_id = ${projectId}
        `;
  const max = Number((rows[0] as { max_code?: number }).max_code ?? 0);
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

export async function generateDefaultMaterialName(sql: Sql, projectId: string): Promise<string> {
  const rows = await sql`
    SELECT COALESCE(
      MAX(CAST(SUBSTRING(name FROM '^MAT ([0-9]+)$') AS int))
        FILTER (WHERE name ~ '^MAT [0-9]+$'),
      0
    ) AS max_n
    FROM materials
    WHERE project_id = ${projectId}
  `;
  const max = Number((rows[0] as { max_n?: number }).max_n ?? 0);
  return `MAT ${String(max + 1).padStart(3, '0')}`;
}

export async function generateDefaultFinishName(sql: Sql, projectId: string): Promise<string> {
  const rows = await sql`
    SELECT COALESCE(
      MAX(CAST(SUBSTRING(name FROM '^FIN ([0-9]+)$') AS int))
        FILTER (WHERE name ~ '^FIN [0-9]+$'),
      0
    ) AS max_n
    FROM finishes
    WHERE project_id = ${projectId}
  `;
  const max = Number((rows[0] as { max_n?: number }).max_n ?? 0);
  return `FIN ${String(max + 1).padStart(3, '0')}`;
}

export async function selectMaterialById(sql: Sql, materialId: string) {
  const rows = await sql`SELECT * FROM materials WHERE id = ${materialId}`;
  return rows[0];
}

export async function selectFinishById(sql: Sql, finishId: string) {
  const rows = await sql`SELECT * FROM finishes WHERE id = ${finishId}`;
  return rows[0];
}

export async function countMaterialReferences(sql: Sql, materialId: string): Promise<number> {
  const rows = await sql`
    SELECT (
      (SELECT COUNT(*) FROM item_materials          WHERE material_id = ${materialId}) +
      (SELECT COUNT(*) FROM proposal_item_materials  WHERE material_id = ${materialId})
    )::int AS total
  `;
  return Number((rows[0] as { total?: number } | undefined)?.total ?? 0);
}

type ForkPatch = {
  name?: string | undefined;
  code?: string | undefined;
  finish_id?: string | null | undefined;
  material_type?: string | null | undefined;
  material_id?: string | undefined;
  description?: string | undefined;
};

export async function forkMaterial(
  sql: Sql,
  _env: Env,
  _uid: string,
  materialId: string,
  patch: ForkPatch,
): Promise<string> {
  const currentRows = await sql`SELECT * FROM materials WHERE id = ${materialId}`;
  const cur = currentRows[0] as {
    id: string;
    project_id: string;
    name: string;
    code: string;
    finish_id: string | null;
    material_type: string | null;
    material_id: string;
    description: string;
  };

  const newCode = await generateNextCode(sql, 'materials', cur.project_id);
  const newName = patch.name ?? cur.name;
  const newMatId = patch.material_id ?? cur.material_id;
  const newDesc = patch.description ?? cur.description;
  const newFinishId = patch.finish_id !== undefined ? patch.finish_id : cur.finish_id;
  const newMaterialType =
    patch.material_type !== undefined ? patch.material_type : cur.material_type;

  const newRows = await sql`
    INSERT INTO materials (project_id, name, code, finish_id, material_type, material_id, description)
    VALUES (
      ${cur.project_id}, ${newName}, ${newCode}, ${newFinishId}, ${newMaterialType},
      ${newMatId}, ${newDesc}
    )
    RETURNING *
  `;
  const newMat = newRows[0] as { id: string };
  return newMat.id;
}
