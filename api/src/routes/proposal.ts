import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import {
  AssignMaterialSchema,
  CreateAndAssignMaterialSchema,
  CreateProposalCategorySchema,
  CreateProposalItemSchema,
  UpdateProposalCategorySchema,
  UpdateProposalItemSchema,
  UpdateRevisionItemCostSchema,
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
import { findOpenRevision, openRevision } from '../lib/revisions';
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

  let ctx: { projectId: string; proposalItemId: string };
  try {
    ctx = await getOwnedProposalItemContext(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const d = parsed.data;

  // Read current project status + any open revision, so we can decide whether
  // this edit triggers a new Revision Round or folds into an existing one.
  const projectRows = await sql`
    SELECT proposal_status FROM projects WHERE id = ${ctx.projectId}
  `;
  const proposalStatus = (projectRows[0] as { proposal_status: string } | undefined)
    ?.proposal_status;
  if (!proposalStatus) return c.json({ error: 'Not found' }, 404);

  let openRev = await findOpenRevision(sql, ctx.projectId);

  // Should this edit's price-affecting changes be written to a Revision
  // Snapshot rather than to proposal_items? True when a revision is open or
  // about to be opened by this very edit.
  const cl = d.change_log;
  const priceAffectingEdit = cl?.is_price_affecting === true;
  const willOpenRevision =
    !openRev &&
    priceAffectingEdit &&
    (proposalStatus === 'pricing_complete' ||
      proposalStatus === 'submitted' ||
      proposalStatus === 'approved');

  if (willOpenRevision) {
    openRev = await openRevision(sql, ctx.projectId, proposalStatus);
  }

  // When a revision context exists, price-affecting fields are written to the
  // snapshot, not to proposal_items. proposal_items keeps the pre-revision
  // baseline until acceptance bakes the latest snapshot in.
  const revisionContext = openRev != null;
  const lockPriceFields = revisionContext;

  // Build the proposal_items UPDATE. Always bump version for optimistic
  // concurrency, even if only non-price fields are changing.
  const updateRows = await sql`
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
      quantity            = CASE WHEN ${lockPriceFields}::boolean THEN quantity
                                 ELSE COALESCE(${d.quantity ?? null}, quantity) END,
      quantity_unit       = COALESCE(${d.quantity_unit ?? null}, quantity_unit),
      unit_cost_cents     = CASE WHEN ${lockPriceFields}::boolean THEN unit_cost_cents
                                 ELSE COALESCE(${d.unit_cost_cents ?? null}, unit_cost_cents) END,
      sort_order          = COALESCE(${d.sort_order ?? null}, sort_order),
      custom_data         = CASE
                              WHEN ${d.custom_data != null}::boolean
                              THEN custom_data || ${JSON.stringify(d.custom_data ?? {})}::jsonb
                              ELSE custom_data
                            END,
      version             = version + 1
    WHERE id = ${id} AND version = ${d.version}
    RETURNING *
  `;
  if (!updateRows[0]) return c.json({ error: 'Conflict or not found' }, 409);

  // Update the Revision Snapshot for this item when relevant.
  if (openRev && cl && priceAffectingEdit) {
    if (cl.column_key === 'quantity' && d.quantity != null) {
      // Quantity-only change: total cost changes, so the PM must review and
      // confirm the new total before advancing to pricing_complete. Flag it
      // with the existing unit_cost_cents pre-filled (not null) so the cell
      // shows the auto-calculated total and the PM can accept or override.
      await sql`
        UPDATE proposal_revision_snapshots
        SET    quantity = ${d.quantity}, cost_status = 'flagged'
        WHERE  revision_id = ${openRev.id} AND item_id = ${id}
      `;
    } else {
      // Price-affecting change: PM must enter a new unit cost manually.
      // Clear unit_cost_cents so the Revision column starts blank for PM input;
      // the pre-revision value remains locked in proposal_items.
      await sql`
        UPDATE proposal_revision_snapshots
        SET    cost_status = 'flagged', unit_cost_cents = NULL
        WHERE  revision_id = ${openRev.id} AND item_id = ${id}
      `;
    }
  }

  // Insert the changelog entry. revision_id ties it to the current revision
  // (or NULL if no revision is open — non-price-affecting edits during a
  // pre-revision status remain orphans until the next revision opens).
  if (cl) {
    await sql`
      INSERT INTO proposal_item_changelog
        (proposal_item_id, column_key, previous_value, new_value, notes,
         proposal_status, revision_id)
      VALUES
        (${id}, ${cl.column_key}, ${cl.previous_value}, ${cl.new_value},
         ${cl.notes ?? null}, ${cl.proposal_status}, ${openRev?.id ?? null})
    `;
  }

  return c.json({ item: updateRows[0] });
});

// PATCH /api/v1/proposal/revisions/:revisionId/items/:itemId/cost
// Resolves a Cost Flag by setting the snapshot's unit_cost_cents for one item
// in the open revision. Refuses to update closed revisions.
router.patch('/proposal/revisions/:revisionId/items/:itemId/cost', async (c) => {
  const uid = c.get('uid');
  const revisionId = c.req.param('revisionId');
  const itemId = c.req.param('itemId');
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = UpdateRevisionItemCostSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  let ctx: { projectId: string; proposalItemId: string };
  try {
    ctx = await getOwnedProposalItemContext(c.env, itemId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  // Verify revision belongs to this project AND is still open.
  const revRows = await sql`
    SELECT id FROM proposal_revisions
    WHERE  id = ${revisionId} AND project_id = ${ctx.projectId} AND closed_at IS NULL
    LIMIT  1
  `;
  if (!revRows[0]) return c.json({ error: 'Revision not open or not found' }, 404);

  const updated = await sql`
    UPDATE proposal_revision_snapshots
    SET    unit_cost_cents = ${parsed.data.unit_cost_cents},
           cost_status = 'resolved'
    WHERE  revision_id = ${revisionId} AND item_id = ${itemId}
    RETURNING revision_id, item_id, quantity, unit_cost_cents, cost_status
  `;
  if (!updated[0]) return c.json({ error: 'Snapshot not found' }, 404);
  return c.json({ snapshot: updated[0] });
});

// GET /api/v1/projects/:projectId/proposal/revisions
// Returns Revision Rounds for the CURRENT acceptance cycle only (revision_major
// = last_revision_major + 1), with their snapshots and changelog entries.
// Historical rounds from prior cycles are preserved in the DB for future
// export but are not included here to keep the table view clean.
router.get('/projects/:projectId/proposal/revisions', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('projectId');
  try {
    await assertProjectOwnership(c.env, projectId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);

  // Determine the current cycle's MAJOR number.
  const projectRows = await sql`
    SELECT last_revision_major FROM projects WHERE id = ${projectId}
  `;
  const lastMajor =
    (projectRows[0] as { last_revision_major: number } | undefined)?.last_revision_major ?? 0;
  const currentMajor = lastMajor + 1;

  const revisions = await sql`
    SELECT id, project_id, revision_major, revision_minor,
           triggered_at_status, opened_at, closed_at
    FROM   proposal_revisions
    WHERE  project_id = ${projectId}
      AND  revision_major = ${currentMajor}
    ORDER  BY revision_minor DESC
  `;
  const snapshots = await sql`
    SELECT s.revision_id, s.item_id, s.quantity, s.unit_cost_cents, s.cost_status
    FROM   proposal_revision_snapshots s
    JOIN   proposal_revisions r ON r.id = s.revision_id
    WHERE  r.project_id = ${projectId}
      AND  r.revision_major = ${currentMajor}
  `;

  // Include changelog entries for the open revision so the client can
  // populate the Revision Notes column without a per-item fetch.
  const changelog = await sql`
    SELECT cl.id, cl.proposal_item_id, cl.column_key, cl.previous_value,
           cl.new_value, cl.notes, cl.proposal_status, cl.revision_id,
           cl.is_price_affecting, cl.changed_at
    FROM   proposal_item_changelog cl
    JOIN   proposal_revisions r ON r.id = cl.revision_id
    WHERE  r.project_id = ${projectId}
      AND  r.revision_major = ${currentMajor}
      AND  r.closed_at IS NULL
    ORDER  BY cl.changed_at ASC
  `;

  return c.json({ revisions, snapshots, changelog });
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
