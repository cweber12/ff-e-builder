import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import {
  AssignMaterialSchema,
  CreateAndAssignMaterialSchema,
  CreateTakeoffCategorySchema,
  CreateTakeoffItemSchema,
  UpdateTakeoffCategorySchema,
  UpdateTakeoffItemSchema,
} from '../types';
import { getDb } from '../lib/db';
import {
  assertProjectOwnership,
  assertTakeoffCategoryOwnership,
  assertTakeoffItemOwnership,
  getOwnedMaterialContext,
  getOwnedTakeoffItemContext,
} from '../lib/ownership';
import {
  selectMaterialById,
  setMaterialSwatches,
  normalizeSwatches,
  generateImportMaterialId,
  generateImportName,
} from './materialHelpers';

const router = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

router.get('/projects/:id/takeoff/categories', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('id');

  try {
    await assertProjectOwnership(c.env, projectId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await sql`
    SELECT *
    FROM takeoff_categories
    WHERE project_id = ${projectId}
    ORDER BY sort_order, created_at
  `;
  return c.json({ categories: rows });
});

router.post('/projects/:id/takeoff/categories', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('id');
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = CreateTakeoffCategorySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    await assertProjectOwnership(c.env, projectId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await sql`
    INSERT INTO takeoff_categories (project_id, name, sort_order)
    VALUES (${projectId}, ${parsed.data.name}, ${parsed.data.sort_order})
    ON CONFLICT (project_id, name) DO UPDATE SET name = EXCLUDED.name
    RETURNING *
  `;
  return c.json({ category: rows[0] }, 201);
});

router.patch('/takeoff/categories/:id', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = UpdateTakeoffCategorySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    await assertTakeoffCategoryOwnership(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await sql`
    UPDATE takeoff_categories
    SET
      name = COALESCE(${parsed.data.name ?? null}, name),
      sort_order = COALESCE(${parsed.data.sort_order ?? null}, sort_order)
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows[0]) return c.json({ error: 'Not found' }, 404);
  return c.json({ category: rows[0] });
});

router.delete('/takeoff/categories/:id', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');
  try {
    await assertTakeoffCategoryOwnership(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  await sql`DELETE FROM takeoff_categories WHERE id = ${id}`;
  return c.body(null, 204);
});

router.get('/takeoff/categories/:id/items', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');
  try {
    await assertTakeoffCategoryOwnership(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await sql`
    SELECT
      ti.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id',          m.id,
            'project_id',  m.project_id,
            'name',        m.name,
            'material_id', m.material_id,
            'description', m.description,
            'swatch_hex',  m.swatch_hex,
            'swatches', COALESCE(
              (
                SELECT array_agg(ms.swatch_hex ORDER BY ms.sort_order)
                FROM material_swatches ms
                WHERE ms.material_id = m.id
              ),
              ARRAY[m.swatch_hex]
            ),
            'finish_classification', m.finish_classification,
            'created_at',  m.created_at,
            'updated_at',  m.updated_at
          ) ORDER BY tim.sort_order
        ) FILTER (WHERE m.id IS NOT NULL),
        '[]'::json
      ) AS materials
    FROM  takeoff_items ti
    LEFT  JOIN takeoff_item_materials tim ON tim.takeoff_item_id = ti.id
    LEFT  JOIN materials m               ON m.id = tim.material_id
    WHERE ti.category_id = ${id}
    GROUP BY ti.id
    ORDER BY ti.sort_order, ti.created_at
  `;
  return c.json({ items: rows });
});

router.post('/takeoff/categories/:id/items', async (c) => {
  const uid = c.get('uid');
  const categoryId = c.req.param('id');
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = CreateTakeoffItemSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    await assertTakeoffCategoryOwnership(c.env, categoryId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await sql`
    INSERT INTO takeoff_items (
      category_id, product_tag, plan, drawings, location, description,
      size_label, size_mode, size_w, size_d, size_h, size_unit, swatches,
      cbm, quantity, quantity_unit, unit_cost_cents, sort_order
    )
    VALUES (
      ${categoryId},
      ${parsed.data.product_tag},
      ${parsed.data.plan},
      ${parsed.data.drawings},
      ${parsed.data.location},
      ${parsed.data.description},
      ${parsed.data.size_label},
      ${parsed.data.size_mode},
      ${parsed.data.size_w},
      ${parsed.data.size_d},
      ${parsed.data.size_h},
      ${parsed.data.size_unit},
      ${JSON.stringify(parsed.data.swatches)}::jsonb,
      ${parsed.data.cbm},
      ${parsed.data.quantity},
      ${parsed.data.quantity_unit},
      ${parsed.data.unit_cost_cents},
      ${parsed.data.sort_order}
    )
    RETURNING *
  `;
  return c.json({ item: rows[0] }, 201);
});

router.patch('/takeoff/items/:id', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = UpdateTakeoffItemSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    await assertTakeoffItemOwnership(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const swatchesJson =
    parsed.data.swatches === undefined ? null : JSON.stringify(parsed.data.swatches);
  const rows = await sql`
    UPDATE takeoff_items
    SET
      category_id = COALESCE(${parsed.data.category_id ?? null}, category_id),
      product_tag = COALESCE(${parsed.data.product_tag ?? null}, product_tag),
      plan = COALESCE(${parsed.data.plan ?? null}, plan),
      drawings = COALESCE(${parsed.data.drawings ?? null}, drawings),
      location = COALESCE(${parsed.data.location ?? null}, location),
      description = COALESCE(${parsed.data.description ?? null}, description),
      size_label = COALESCE(${parsed.data.size_label ?? null}, size_label),
      size_mode = COALESCE(${parsed.data.size_mode ?? null}, size_mode),
      size_w = COALESCE(${parsed.data.size_w ?? null}, size_w),
      size_d = COALESCE(${parsed.data.size_d ?? null}, size_d),
      size_h = COALESCE(${parsed.data.size_h ?? null}, size_h),
      size_unit = COALESCE(${parsed.data.size_unit ?? null}, size_unit),
      swatches = COALESCE(${swatchesJson}::jsonb, swatches),
      cbm = COALESCE(${parsed.data.cbm ?? null}, cbm),
      quantity = COALESCE(${parsed.data.quantity ?? null}, quantity),
      quantity_unit = COALESCE(${parsed.data.quantity_unit ?? null}, quantity_unit),
      unit_cost_cents = COALESCE(${parsed.data.unit_cost_cents ?? null}, unit_cost_cents),
      sort_order = COALESCE(${parsed.data.sort_order ?? null}, sort_order),
      version = version + 1
    WHERE id = ${id} AND version = ${parsed.data.version}
    RETURNING *
  `;
  if (!rows[0]) return c.json({ error: 'Conflict or not found' }, 409);
  return c.json({ item: rows[0] });
});

router.delete('/takeoff/items/:id', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');
  try {
    await assertTakeoffItemOwnership(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  await sql`DELETE FROM takeoff_items WHERE id = ${id}`;
  return c.body(null, 204);
});

// ─── Takeoff item ↔ material library routes ───────────────────────────────

router.post('/takeoff/items/:id/materials', async (c) => {
  const uid = c.get('uid');
  const takeoffItemId = c.req.param('id');
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = AssignMaterialSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  let itemCtx: { projectId: string; takeoffItemId: string };
  let matCtx: { projectId: string; materialId: string };
  try {
    itemCtx = await getOwnedTakeoffItemContext(c.env, takeoffItemId, uid);
    matCtx = await getOwnedMaterialContext(c.env, parsed.data.material_id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }
  if (itemCtx.projectId !== matCtx.projectId) {
    return c.json({ error: 'Material does not belong to this project' }, 400);
  }

  const sql = getDb(c.env);
  const maxRows = await sql`
    SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort
    FROM   takeoff_item_materials
    WHERE  takeoff_item_id = ${takeoffItemId}
  `;
  const nextSort = Number((maxRows[0] as { next_sort?: number }).next_sort ?? 0);
  await sql`
    INSERT INTO takeoff_item_materials (takeoff_item_id, material_id, sort_order)
    VALUES (${takeoffItemId}, ${parsed.data.material_id}, ${nextSort})
    ON CONFLICT (takeoff_item_id, material_id) DO NOTHING
  `;
  return c.json({ material: await selectMaterialById(sql, parsed.data.material_id) }, 201);
});

router.post('/takeoff/items/:id/materials/new', async (c) => {
  const uid = c.get('uid');
  const takeoffItemId = c.req.param('id');
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = CreateAndAssignMaterialSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  let itemCtx: { projectId: string; takeoffItemId: string };
  try {
    itemCtx = await getOwnedTakeoffItemContext(c.env, takeoffItemId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const swatches = normalizeSwatches(parsed.data.swatches, parsed.data.swatch_hex);
  const classification = parsed.data.finish_classification ?? 'swatch';
  const name = parsed.data.name.trim() || (await generateImportName(sql, itemCtx.projectId));
  const materialId =
    parsed.data.material_id.trim() || (await generateImportMaterialId(sql, itemCtx.projectId));
  const matRows = await sql`
    INSERT INTO materials (project_id, name, material_id, description, swatch_hex, finish_classification)
    VALUES (
      ${itemCtx.projectId},
      ${name},
      ${materialId},
      ${parsed.data.description},
      ${swatches[0] ?? '#D9D4C8'},
      ${classification}
    )
    ON CONFLICT (project_id, (lower(name)))
    DO UPDATE SET
      material_id = COALESCE(NULLIF(EXCLUDED.material_id, ''), materials.material_id),
      description = COALESCE(NULLIF(EXCLUDED.description, ''), materials.description),
      swatch_hex  = EXCLUDED.swatch_hex,
      finish_classification = EXCLUDED.finish_classification
    RETURNING *
  `;
  const mat = matRows[0] as { id: string };
  await setMaterialSwatches(sql, mat.id, swatches);
  const maxRows = await sql`
    SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort
    FROM   takeoff_item_materials
    WHERE  takeoff_item_id = ${takeoffItemId}
  `;
  const nextSort = Number((maxRows[0] as { next_sort?: number }).next_sort ?? 0);
  await sql`
    INSERT INTO takeoff_item_materials (takeoff_item_id, material_id, sort_order)
    VALUES (${takeoffItemId}, ${mat.id}, ${nextSort})
    ON CONFLICT (takeoff_item_id, material_id) DO NOTHING
  `;
  return c.json({ material: await selectMaterialById(sql, mat.id) }, 201);
});

router.delete('/takeoff/items/:id/materials/:materialId', async (c) => {
  const uid = c.get('uid');
  const takeoffItemId = c.req.param('id');
  const materialId = c.req.param('materialId');
  try {
    await assertTakeoffItemOwnership(c.env, takeoffItemId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  await sql`
    DELETE FROM takeoff_item_materials
    WHERE  takeoff_item_id = ${takeoffItemId} AND material_id = ${materialId}
  `;
  return c.body(null, 204);
});

export { router as takeoffRouter };
