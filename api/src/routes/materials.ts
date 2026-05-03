import { Hono, type Context } from 'hono';
import type { Env, HonoVariables } from '../types';
import {
  AssignMaterialSchema,
  CreateAndAssignMaterialSchema,
  CreateMaterialSchema,
  UpdateMaterialSchema,
} from '../types';
import {
  assertItemOwnership,
  assertMaterialOwnership,
  assertProjectOwnership,
  getOwnedItemContext,
  getOwnedMaterialContext,
} from '../lib/ownership';
import { getDb } from '../lib/db';

const router = new Hono<{ Bindings: Env; Variables: HonoVariables }>();
const defaultSwatch = '#D9D4C8';

type Sql = ReturnType<typeof getDb>;
type AppContext = Context<{ Bindings: Env; Variables: HonoVariables }>;
type MaterialRow = { id: string; swatch_hex: string };

function normalizeSwatches(swatches: string[] | undefined, swatchHex: string | undefined) {
  const candidates = swatches?.length ? swatches : [swatchHex ?? defaultSwatch];
  return candidates.filter((swatch, index) => candidates.indexOf(swatch) === index).slice(0, 1);
}

async function setMaterialSwatches(sql: Sql, materialId: string, swatches: string[]) {
  await sql`DELETE FROM material_swatches WHERE material_id = ${materialId}`;
  for (const [index, swatch] of swatches.entries()) {
    await sql`
      INSERT INTO material_swatches (material_id, swatch_hex, sort_order)
      VALUES (${materialId}, ${swatch}, ${index})
    `;
  }
}

async function selectMaterialById(sql: Sql, materialId: string) {
  const rows = await sql`
    SELECT
      m.*,
      COALESCE(
        array_agg(ms.swatch_hex ORDER BY ms.sort_order) FILTER (WHERE ms.id IS NOT NULL),
        ARRAY[m.swatch_hex]
      ) AS swatches
    FROM materials m
    LEFT JOIN material_swatches ms ON ms.material_id = m.id
    WHERE m.id = ${materialId}
    GROUP BY m.id
  `;
  return rows[0];
}

async function listProjectMaterials(c: AppContext) {
  const uid = c.get('uid');
  const projectId = c.req.param('projectId');

  try {
    await assertProjectOwnership(c.env, projectId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await sql`
    SELECT
      m.*,
      COALESCE(
        array_agg(ms.swatch_hex ORDER BY ms.sort_order) FILTER (WHERE ms.id IS NOT NULL),
        ARRAY[m.swatch_hex]
      ) AS swatches
    FROM materials m
    LEFT JOIN material_swatches ms ON ms.material_id = m.id
    WHERE m.project_id = ${projectId}
    GROUP BY m.id
    ORDER BY lower(m.name), m.created_at
  `;
  return c.json({ materials: rows });
}

async function createProjectMaterial(c: AppContext) {
  const uid = c.get('uid');
  const projectId = c.req.param('projectId');
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = CreateMaterialSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    await assertProjectOwnership(c.env, projectId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const swatches = normalizeSwatches(parsed.data.swatches, parsed.data.swatch_hex);
  const rows = await sql`
    INSERT INTO materials (project_id, name, material_id, description, swatch_hex)
    VALUES (
      ${projectId},
      ${parsed.data.name},
      ${parsed.data.material_id},
      ${parsed.data.description},
      ${swatches[0] ?? defaultSwatch}
    )
    ON CONFLICT (project_id, (lower(name)))
    DO UPDATE SET
      material_id = COALESCE(NULLIF(EXCLUDED.material_id, ''), materials.material_id),
      description = COALESCE(NULLIF(EXCLUDED.description, ''), materials.description),
      swatch_hex = EXCLUDED.swatch_hex
    RETURNING *
  `;
  const material = rows[0] as MaterialRow;
  await setMaterialSwatches(sql, material.id, swatches);
  return c.json({ material: await selectMaterialById(sql, material.id) }, 201);
}

router.get('/:projectId/materials', listProjectMaterials);
router.get('/projects/:projectId/materials', listProjectMaterials);
router.post('/:projectId/materials', createProjectMaterial);
router.post('/projects/:projectId/materials', createProjectMaterial);

router.patch('/materials/:id', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = UpdateMaterialSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    await assertMaterialOwnership(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const currentRows = await sql`SELECT swatch_hex FROM materials WHERE id = ${id}`;
  const currentSwatch = (currentRows[0] as { swatch_hex?: string } | undefined)?.swatch_hex;
  const swatches =
    parsed.data.swatches !== undefined || parsed.data.swatch_hex !== undefined
      ? normalizeSwatches(parsed.data.swatches, parsed.data.swatch_hex ?? currentSwatch)
      : undefined;
  const rows = await sql`
    UPDATE materials
    SET
      name = COALESCE(${parsed.data.name ?? null}, name),
      material_id = COALESCE(${parsed.data.material_id ?? null}, material_id),
      description = COALESCE(${parsed.data.description ?? null}, description),
      swatch_hex = COALESCE(${swatches?.[0] ?? null}, swatch_hex)
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows[0]) return c.json({ error: 'Not found' }, 404);
  if (swatches) await setMaterialSwatches(sql, id, swatches);
  return c.json({ material: await selectMaterialById(sql, id) });
});

router.delete('/materials/:id', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');

  try {
    await assertMaterialOwnership(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  await sql`DELETE FROM materials WHERE id = ${id}`;
  return c.body(null, 204);
});

router.post('/items/:itemId/materials', async (c) => {
  const uid = c.get('uid');
  const itemId = c.req.param('itemId');
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = AssignMaterialSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  let itemContext: { projectId: string; roomId: string; itemId: string };
  let materialContext: { projectId: string; materialId: string };
  try {
    itemContext = await getOwnedItemContext(c.env, itemId, uid);
    materialContext = await getOwnedMaterialContext(c.env, parsed.data.material_id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  if (itemContext.projectId !== materialContext.projectId) {
    return c.json({ error: 'Material does not belong to this item project' }, 400);
  }

  const sql = getDb(c.env);
  const maxRows = await sql`
    SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
    FROM item_materials
    WHERE item_id = ${itemId}
  `;
  const nextSortOrder = Number((maxRows[0] as { next_sort_order?: number }).next_sort_order ?? 0);
  await sql`
    INSERT INTO item_materials (item_id, material_id, sort_order)
    VALUES (${itemId}, ${parsed.data.material_id}, ${nextSortOrder})
    ON CONFLICT (item_id, material_id) DO NOTHING
  `;
  const material = await selectMaterialById(sql, parsed.data.material_id);
  await assertItemOwnership(c.env, itemId, uid);
  return c.json({ material }, 201);
});

router.post('/items/:itemId/materials/new', async (c) => {
  const uid = c.get('uid');
  const itemId = c.req.param('itemId');
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = CreateAndAssignMaterialSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  let itemContext: { projectId: string; roomId: string; itemId: string };
  try {
    itemContext = await getOwnedItemContext(c.env, itemId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const swatches = normalizeSwatches(parsed.data.swatches, parsed.data.swatch_hex);
  const materialRows = await sql`
    INSERT INTO materials (project_id, name, material_id, description, swatch_hex)
    VALUES (
      ${itemContext.projectId},
      ${parsed.data.name},
      ${parsed.data.material_id},
      ${parsed.data.description},
      ${swatches[0] ?? defaultSwatch}
    )
    ON CONFLICT (project_id, (lower(name)))
    DO UPDATE SET
      material_id = COALESCE(NULLIF(EXCLUDED.material_id, ''), materials.material_id),
      description = COALESCE(NULLIF(EXCLUDED.description, ''), materials.description),
      swatch_hex = EXCLUDED.swatch_hex
    RETURNING *
  `;
  const material = materialRows[0] as { id: string };
  await setMaterialSwatches(sql, material.id, swatches);
  const maxRows = await sql`
    SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
    FROM item_materials
    WHERE item_id = ${itemId}
  `;
  const nextSortOrder = Number((maxRows[0] as { next_sort_order?: number }).next_sort_order ?? 0);
  await sql`
    INSERT INTO item_materials (item_id, material_id, sort_order)
    VALUES (${itemId}, ${material.id}, ${nextSortOrder})
    ON CONFLICT (item_id, material_id) DO NOTHING
  `;
  return c.json({ material: await selectMaterialById(sql, material.id) }, 201);
});

router.delete('/items/:itemId/materials/:materialId', async (c) => {
  const uid = c.get('uid');
  const itemId = c.req.param('itemId');
  const materialId = c.req.param('materialId');

  try {
    await assertItemOwnership(c.env, itemId, uid);
    await assertMaterialOwnership(c.env, materialId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  await sql`
    DELETE FROM item_materials
    WHERE item_id = ${itemId} AND material_id = ${materialId}
  `;
  return c.body(null, 204);
});

export { router as materialsRouter };
