import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import {
  ColumnDefTableTypeSchema,
  CreateItemColumnDefSchema,
  UpdateItemColumnDefSchema,
} from '../types';
import { assertProjectOwnership } from '../lib/ownership';
import { getDb } from '../lib/db';

const router = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

const MAX_COLUMN_DEFS = 10;

// GET /api/v1/projects/:id/column-defs?tableType=ffe|proposal
router.get('/:id/column-defs', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('id');
  const tableTypeParsed = ColumnDefTableTypeSchema.safeParse(c.req.query('tableType') ?? 'ffe');
  if (!tableTypeParsed.success) return c.json({ error: 'Invalid tableType' }, 400);
  const tableType = tableTypeParsed.data;

  try {
    await assertProjectOwnership(c.env, projectId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await sql`
    SELECT id, project_id, label, sort_order, table_type, created_at, updated_at
    FROM item_column_defs
    WHERE project_id = ${projectId} AND table_type = ${tableType}
    ORDER BY sort_order, created_at
  `;
  return c.json({ column_defs: rows });
});

// POST /api/v1/projects/:id/column-defs
router.post('/:id/column-defs', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('id');

  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = CreateItemColumnDefSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    await assertProjectOwnership(c.env, projectId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const tableType = parsed.data.table_type;
  const sql = getDb(c.env);
  const countRows = await sql`
    SELECT COUNT(*)::int AS count
    FROM item_column_defs
    WHERE project_id = ${projectId} AND table_type = ${tableType}
  `;
  const current = (countRows[0] as { count: number }).count;
  if (current >= MAX_COLUMN_DEFS) {
    return c.json({ error: `Maximum ${MAX_COLUMN_DEFS} custom columns per table` }, 422);
  }

  const rows = await sql`
    INSERT INTO item_column_defs (project_id, label, sort_order, table_type)
    VALUES (${projectId}, ${parsed.data.label}, ${parsed.data.sort_order}, ${tableType})
    RETURNING id, project_id, label, sort_order, table_type, created_at, updated_at
  `;
  return c.json({ column_def: rows[0] }, 201);
});

// PATCH /api/v1/projects/:id/column-defs/:defId
router.patch('/:id/column-defs/:defId', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('id');
  const defId = c.req.param('defId');

  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = UpdateItemColumnDefSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    await assertProjectOwnership(c.env, projectId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await sql`
    UPDATE item_column_defs
    SET
      label      = COALESCE(${parsed.data.label ?? null}, label),
      sort_order = COALESCE(${parsed.data.sort_order ?? null}, sort_order)
    WHERE id = ${defId} AND project_id = ${projectId}
    RETURNING id, project_id, label, sort_order, table_type, created_at, updated_at
  `;
  if (!rows[0]) return c.json({ error: 'Not found' }, 404);
  return c.json({ column_def: rows[0] });
});

// DELETE /api/v1/projects/:id/column-defs/:defId
// Note: orphan keys in custom_data are ignored at read time (lazy cleanup).
router.delete('/:id/column-defs/:defId', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('id');
  const defId = c.req.param('defId');

  try {
    await assertProjectOwnership(c.env, projectId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  await sql.transaction([
    sql`
      DELETE FROM proposal_item_changelog clg
      USING proposal_items pi, proposal_categories pc
      WHERE clg.column_key    = ${defId}
        AND clg.proposal_item_id = pi.id
        AND pi.category_id    = pc.id
        AND pc.project_id     = ${projectId}
    `,
    sql`
      DELETE FROM item_column_defs
      WHERE id = ${defId} AND project_id = ${projectId}
    `,
  ]);
  return c.body(null, 204);
});

export { router as columnDefsRouter };
