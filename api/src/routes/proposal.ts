import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import {
  AssignMaterialSchema,
  CreateAndAssignMaterialSchema,
  CreateProposalCategorySchema,
  CreateProposalItemSchema,
  UpdateProposalCategorySchema,
  UpdateProposalItemSchema,
} from '../types';
import { getDb } from '../lib/db';
import { deleteR2Keys } from '../lib/r2';
import {
  assertProjectOwnership,
  assertProposalCategoryOwnership,
  assertProposalItemOwnership,
  getOwnedMaterialContext,
  getOwnedProposalItemContext,
} from '../lib/ownership';
import {
  selectMaterialById,
  generateImportMaterialId,
  generateImportName,
} from './materialHelpers';

const router = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

router.get('/projects/:id/proposal/categories', async (c) => {
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
    FROM proposal_categories
    WHERE project_id = ${projectId}
    ORDER BY sort_order, created_at
  `;
  return c.json({ categories: rows });
});

router.post('/projects/:id/proposal/categories', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('id');
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = CreateProposalCategorySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    await assertProjectOwnership(c.env, projectId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await sql`
    INSERT INTO proposal_categories (project_id, name, sort_order)
    VALUES (${projectId}, ${parsed.data.name}, ${parsed.data.sort_order})
    ON CONFLICT (project_id, name) DO UPDATE SET name = EXCLUDED.name
    RETURNING *
  `;
  return c.json({ category: rows[0] }, 201);
});

router.patch('/proposal/categories/:id', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = UpdateProposalCategorySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    await assertProposalCategoryOwnership(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await sql`
    UPDATE proposal_categories
    SET
      name = COALESCE(${parsed.data.name ?? null}, name),
      sort_order = COALESCE(${parsed.data.sort_order ?? null}, sort_order)
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows[0]) return c.json({ error: 'Not found' }, 404);
  return c.json({ category: rows[0] });
});

router.delete('/proposal/categories/:id', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');
  try {
    await assertProposalCategoryOwnership(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  await sql`DELETE FROM proposal_categories WHERE id = ${id}`;
  return c.body(null, 204);
});

router.get('/proposal/categories/:id/items', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');
  try {
    await assertProposalCategoryOwnership(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await sql`
    SELECT
      pi.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id',          m.id,
            'project_id',  m.project_id,
            'name',        m.name,
            'material_id', m.material_id,
            'description', m.description,
            'swatch_hex',  m.swatch_hex,
            'created_at',  m.created_at,
            'updated_at',  m.updated_at
          ) ORDER BY pim.sort_order
        ) FILTER (WHERE m.id IS NOT NULL),
        '[]'::json
      ) AS materials
    FROM  proposal_items pi
    LEFT  JOIN proposal_item_materials pim ON pim.proposal_item_id = pi.id
    LEFT  JOIN materials m                 ON m.id = pim.material_id
    WHERE pi.category_id = ${id}
    GROUP BY pi.id
    ORDER BY pi.sort_order, pi.created_at
  `;
  return c.json({ items: rows });
});

router.post('/proposal/categories/:id/items', async (c) => {
  const uid = c.get('uid');
  const categoryId = c.req.param('id');
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = CreateProposalItemSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    await assertProposalCategoryOwnership(c.env, categoryId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await sql`
    INSERT INTO proposal_items (
      category_id, product_tag, plan, drawings, location, description, notes,
      size_label, size_mode, size_w, size_d, size_h, size_unit,
      cbm, quantity, quantity_unit, unit_cost_cents, sort_order, custom_data
    )
    VALUES (
      ${categoryId},
      ${parsed.data.product_tag},
      ${parsed.data.plan},
      ${parsed.data.drawings},
      ${parsed.data.location},
      ${parsed.data.description},
      ${parsed.data.notes},
      ${parsed.data.size_label},
      ${parsed.data.size_mode},
      ${parsed.data.size_w},
      ${parsed.data.size_d},
      ${parsed.data.size_h},
      ${parsed.data.size_unit},
      ${parsed.data.cbm},
      ${parsed.data.quantity},
      ${parsed.data.quantity_unit},
      ${parsed.data.unit_cost_cents},
      ${parsed.data.sort_order},
      ${JSON.stringify(parsed.data.custom_data)}
    )
    RETURNING *
  `;
  return c.json({ item: rows[0] }, 201);
});

router.patch('/proposal/items/:id', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = UpdateProposalItemSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    await assertProposalItemOwnership(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const d = parsed.data;

  const clearDeferred = d.unit_cost_cents != null;
  const setDeferred = d.cost_update_deferred === true && !clearDeferred;

  const updateQuery = sql`
    UPDATE proposal_items
    SET
      category_id         = COALESCE(${d.category_id ?? null}, category_id),
      product_tag         = COALESCE(${d.product_tag ?? null}, product_tag),
      plan                = COALESCE(${d.plan ?? null}, plan),
      drawings            = COALESCE(${d.drawings ?? null}, drawings),
      location            = COALESCE(${d.location ?? null}, location),
      description         = COALESCE(${d.description ?? null}, description),
      notes               = COALESCE(${d.notes ?? null}, notes),
      size_label          = COALESCE(${d.size_label ?? null}, size_label),
      size_mode           = COALESCE(${d.size_mode ?? null}, size_mode),
      size_w              = COALESCE(${d.size_w ?? null}, size_w),
      size_d              = COALESCE(${d.size_d ?? null}, size_d),
      size_h              = COALESCE(${d.size_h ?? null}, size_h),
      size_unit           = COALESCE(${d.size_unit ?? null}, size_unit),
      cbm                 = COALESCE(${d.cbm ?? null}, cbm),
      quantity            = COALESCE(${d.quantity ?? null}, quantity),
      quantity_unit       = COALESCE(${d.quantity_unit ?? null}, quantity_unit),
      unit_cost_cents     = COALESCE(${d.unit_cost_cents ?? null}, unit_cost_cents),
      sort_order          = COALESCE(${d.sort_order ?? null}, sort_order),
      custom_data         = CASE
                              WHEN ${d.custom_data != null}::boolean
                              THEN custom_data || ${JSON.stringify(d.custom_data ?? {})}::jsonb
                              ELSE custom_data
                            END,
      cost_update_deferred = CASE
                               WHEN ${clearDeferred}::boolean THEN false
                               WHEN ${setDeferred}::boolean   THEN true
                               ELSE cost_update_deferred
                             END,
      version             = version + 1
    WHERE id = ${id} AND version = ${d.version}
    RETURNING *
  `;

  if (!d.change_log) {
    const rows = await updateQuery;
    if (!rows[0]) return c.json({ error: 'Conflict or not found' }, 409);
    return c.json({ item: rows[0] });
  }

  const cl = d.change_log;
  const changeId = crypto.randomUUID();

  const insertPrimary = sql`
    INSERT INTO proposal_item_changelog
      (id, proposal_item_id, column_key, previous_value, new_value, notes, proposal_status)
    VALUES
      (${changeId}, ${id}, ${cl.column_key}, ${cl.previous_value}, ${cl.new_value},
       ${cl.notes ?? null}, ${cl.proposal_status})
  `;

  const queries: ReturnType<typeof sql>[] = [updateQuery, insertPrimary];

  if (cl.linked_unit_cost_change) {
    const luc = cl.linked_unit_cost_change;
    queries.push(sql`
      INSERT INTO proposal_item_changelog
        (proposal_item_id, column_key, previous_value, new_value, proposal_status, related_change_id)
      VALUES
        (${id}, 'unit_cost_cents', ${luc.previous_value}, ${luc.new_value},
         ${cl.proposal_status}, ${changeId})
    `);
  }

  const results = await sql.transaction(queries);
  const updatedItem = (results[0] as (typeof results)[0])[0];
  if (!updatedItem) return c.json({ error: 'Conflict or not found' }, 409);
  return c.json({ item: updatedItem });
});

router.get('/proposal/items/:id/changelog', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');
  try {
    await assertProposalItemOwnership(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }
  const sql = getDb(c.env);
  const rows = await sql`
    SELECT * FROM proposal_item_changelog
    WHERE proposal_item_id = ${id}
    ORDER BY changed_at DESC
  `;
  return c.json({ changelog: rows });
});

router.delete('/proposal/items/:id', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');
  try {
    await assertProposalItemOwnership(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const imageRows = await sql`SELECT r2_key FROM image_assets WHERE proposal_item_id = ${id}`;
  await deleteR2Keys(
    c.env.IMAGES_BUCKET,
    (imageRows as { r2_key: string }[]).map((r) => r.r2_key),
  );
  await sql`DELETE FROM proposal_items WHERE id = ${id}`;
  return c.body(null, 204);
});

// ─── Proposal item ↔ material library routes ─────────────────────────────

router.post('/proposal/items/:id/materials', async (c) => {
  const uid = c.get('uid');
  const proposalItemId = c.req.param('id');
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = AssignMaterialSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  let itemCtx: { projectId: string; proposalItemId: string };
  let matCtx: { projectId: string; materialId: string };
  try {
    itemCtx = await getOwnedProposalItemContext(c.env, proposalItemId, uid);
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
    FROM   proposal_item_materials
    WHERE  proposal_item_id = ${proposalItemId}
  `;
  const nextSort = Number((maxRows[0] as { next_sort?: number }).next_sort ?? 0);
  await sql`
    INSERT INTO proposal_item_materials (proposal_item_id, material_id, sort_order)
    VALUES (${proposalItemId}, ${parsed.data.material_id}, ${nextSort})
    ON CONFLICT (proposal_item_id, material_id) DO NOTHING
  `;
  return c.json({ material: await selectMaterialById(sql, parsed.data.material_id) }, 201);
});

router.post('/proposal/items/:id/materials/new', async (c) => {
  const uid = c.get('uid');
  const proposalItemId = c.req.param('id');
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = CreateAndAssignMaterialSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  let itemCtx: { projectId: string; proposalItemId: string };
  try {
    itemCtx = await getOwnedProposalItemContext(c.env, proposalItemId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const name = parsed.data.name.trim() || (await generateImportName(sql, itemCtx.projectId));
  const materialId =
    parsed.data.material_id.trim() || (await generateImportMaterialId(sql, itemCtx.projectId));
  const matRows = await sql`
    INSERT INTO materials (project_id, name, material_id, description, swatch_hex)
    VALUES (
      ${itemCtx.projectId},
      ${name},
      ${materialId},
      ${parsed.data.description},
      ${parsed.data.swatch_hex ?? '#D9D4C8'}
    )
    ON CONFLICT (project_id, (lower(name)))
    DO UPDATE SET
      material_id = COALESCE(NULLIF(EXCLUDED.material_id, ''), materials.material_id),
      description = COALESCE(NULLIF(EXCLUDED.description, ''), materials.description),
      swatch_hex  = EXCLUDED.swatch_hex
    RETURNING *
  `;
  const mat = matRows[0] as { id: string };
  const maxRows = await sql`
    SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort
    FROM   proposal_item_materials
    WHERE  proposal_item_id = ${proposalItemId}
  `;
  const nextSort = Number((maxRows[0] as { next_sort?: number }).next_sort ?? 0);
  await sql`
    INSERT INTO proposal_item_materials (proposal_item_id, material_id, sort_order)
    VALUES (${proposalItemId}, ${mat.id}, ${nextSort})
    ON CONFLICT (proposal_item_id, material_id) DO NOTHING
  `;
  return c.json({ material: await selectMaterialById(sql, mat.id) }, 201);
});

router.delete('/proposal/items/:id/materials/:materialId', async (c) => {
  const uid = c.get('uid');
  const proposalItemId = c.req.param('id');
  const materialId = c.req.param('materialId');
  try {
    await assertProposalItemOwnership(c.env, proposalItemId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  await sql`
    DELETE FROM proposal_item_materials
    WHERE  proposal_item_id = ${proposalItemId} AND material_id = ${materialId}
  `;
  return c.body(null, 204);
});

export { router as proposalRouter };
