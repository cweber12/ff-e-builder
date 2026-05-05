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
  assertProposalItemOwnership,
  getOwnedItemContext,
  getOwnedMaterialContext,
} from '../lib/ownership';
import { getDb } from '../lib/db';
import { deleteR2Keys } from '../lib/r2';
import {
  countMaterialReferences,
  forkMaterial,
  generateImportMaterialId,
  generateImportName,
  selectMaterialById,
} from './materialHelpers';

const DEFAULT_SWATCH = '#D9D4C8';
const router = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

type AppContext = Context<{ Bindings: Env; Variables: HonoVariables }>;
type MaterialRow = { id: string; swatch_hex: string };

async function listProjectMaterials(c: AppContext) {
  const uid = c.get('uid');
  const projectId = c.req.param('projectId');
  if (!projectId) return c.json({ error: 'Not found' }, 404);

  try {
    await assertProjectOwnership(c.env, projectId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await sql`
    SELECT * FROM materials
    WHERE project_id = ${projectId}
    ORDER BY lower(name), created_at
  `;
  return c.json({ materials: rows });
}

async function createProjectMaterial(c: AppContext) {
  const uid = c.get('uid');
  const projectId = c.req.param('projectId');
  if (!projectId) return c.json({ error: 'Not found' }, 404);
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = CreateMaterialSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    await assertProjectOwnership(c.env, projectId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const name = parsed.data.name.trim() || (await generateImportName(sql, projectId));
  const materialId =
    parsed.data.material_id.trim() || (await generateImportMaterialId(sql, projectId));
  const rows = await sql`
    INSERT INTO materials (project_id, name, material_id, description, swatch_hex)
    VALUES (
      ${projectId},
      ${name},
      ${materialId},
      ${parsed.data.description},
      ${parsed.data.swatch_hex ?? DEFAULT_SWATCH}
    )
    ON CONFLICT (project_id, (lower(name)))
    DO UPDATE SET
      material_id = COALESCE(NULLIF(EXCLUDED.material_id, ''), materials.material_id),
      description = COALESCE(NULLIF(EXCLUDED.description, ''), materials.description),
      swatch_hex = EXCLUDED.swatch_hex
    RETURNING *
  `;
  const material = rows[0] as MaterialRow;
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
  const rows = await sql`
    UPDATE materials
    SET
      name = COALESCE(${parsed.data.name ?? null}, name),
      material_id = COALESCE(${parsed.data.material_id ?? null}, material_id),
      description = COALESCE(${parsed.data.description ?? null}, description),
      swatch_hex = COALESCE(${parsed.data.swatch_hex ?? null}, swatch_hex)
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows[0]) return c.json({ error: 'Not found' }, 404);
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
  const imageRows = await sql`SELECT r2_key FROM image_assets WHERE material_id = ${id}`;
  await deleteR2Keys(
    c.env.IMAGES_BUCKET,
    (imageRows as { r2_key: string }[]).map((r) => r.r2_key),
  );
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
  const name = parsed.data.name.trim() || (await generateImportName(sql, itemContext.projectId));
  const materialId =
    parsed.data.material_id.trim() || (await generateImportMaterialId(sql, itemContext.projectId));
  const materialRows = await sql`
    INSERT INTO materials (project_id, name, material_id, description, swatch_hex)
    VALUES (
      ${itemContext.projectId},
      ${name},
      ${materialId},
      ${parsed.data.description},
      ${parsed.data.swatch_hex ?? DEFAULT_SWATCH}
    )
    ON CONFLICT (project_id, (lower(name)))
    DO UPDATE SET
      material_id = COALESCE(NULLIF(EXCLUDED.material_id, ''), materials.material_id),
      description = COALESCE(NULLIF(EXCLUDED.description, ''), materials.description),
      swatch_hex = EXCLUDED.swatch_hex
    RETURNING *
  `;
  const material = materialRows[0] as { id: string };
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

// ─── Scoped update with copy-on-write for shared materials ────────────────

router.patch('/items/:itemId/materials/:materialId', async (c) => {
  const uid = c.get('uid');
  const itemId = c.req.param('itemId');
  const materialId = c.req.param('materialId');
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = UpdateMaterialSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    await assertItemOwnership(c.env, itemId, uid);
    await assertMaterialOwnership(c.env, materialId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const refCount = await countMaterialReferences(sql, materialId);

  let finalId = materialId;
  if (refCount > 1) {
    finalId = await forkMaterial(sql, c.env, uid, materialId, parsed.data);
    await sql`
      UPDATE item_materials
      SET material_id = ${finalId}
      WHERE item_id = ${itemId} AND material_id = ${materialId}
    `;
  } else {
    await sql`
      UPDATE materials SET
        name        = COALESCE(${parsed.data.name ?? null}, name),
        material_id = COALESCE(${parsed.data.material_id ?? null}, material_id),
        description = COALESCE(${parsed.data.description ?? null}, description),
        swatch_hex  = COALESCE(${parsed.data.swatch_hex ?? null}, swatch_hex)
      WHERE id = ${materialId}
    `;
  }
  return c.json({ material: await selectMaterialById(sql, finalId) });
});

router.patch('/proposal/items/:proposalItemId/materials/:materialId', async (c) => {
  const uid = c.get('uid');
  const proposalItemId = c.req.param('proposalItemId');
  const materialId = c.req.param('materialId');
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = UpdateMaterialSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    await assertProposalItemOwnership(c.env, proposalItemId, uid);
    await assertMaterialOwnership(c.env, materialId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const refCount = await countMaterialReferences(sql, materialId);

  let finalId = materialId;
  if (refCount > 1) {
    finalId = await forkMaterial(sql, c.env, uid, materialId, parsed.data);
    await sql`
      UPDATE proposal_item_materials
      SET material_id = ${finalId}
      WHERE proposal_item_id = ${proposalItemId} AND material_id = ${materialId}
    `;
  } else {
    await sql`
      UPDATE materials SET
        name        = COALESCE(${parsed.data.name ?? null}, name),
        material_id = COALESCE(${parsed.data.material_id ?? null}, material_id),
        description = COALESCE(${parsed.data.description ?? null}, description),
        swatch_hex  = COALESCE(${parsed.data.swatch_hex ?? null}, swatch_hex)
      WHERE id = ${materialId}
    `;
  }
  return c.json({ material: await selectMaterialById(sql, finalId) });
});

export { router as materialsRouter };
