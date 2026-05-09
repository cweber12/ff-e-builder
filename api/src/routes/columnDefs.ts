import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { CreateItemColumnDefSchema, UpdateItemColumnDefSchema } from '../types';
import { assertProjectOwnership } from '../lib/ownership';
import { getDb } from '../lib/db';

const router = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

const MAX_COLUMN_DEFS = 10;

// GET /api/v1/projects/:id/column-defs — list all custom column defs for a project
router.get('/:id/column-defs', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('id');

  try {
    await assertProjectOwnership(c.env, projectId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await sql`
    SELECT id, project_id, label, sort_order, created_at, updated_at
    FROM item_column_defs
    WHERE project_id = ${projectId}
    ORDER BY sort_order, created_at
  `;
  return c.json({ column_defs: rows });
});

// POST /api/v1/projects/:id/column-defs — create a custom column def
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

  const sql = getDb(c.env);
  const countRows = await sql`
    SELECT COUNT(*)::int AS count
    FROM item_column_defs
    WHERE project_id = ${projectId}
  `;
  const current = (countRows[0] as { count: number }).count;
  if (current >= MAX_COLUMN_DEFS) {
    return c.json({ error: `Maximum ${MAX_COLUMN_DEFS} custom columns per project` }, 422);
  }

  const rows = await sql`
    INSERT INTO item_column_defs (project_id, label, sort_order)
    VALUES (${projectId}, ${parsed.data.label}, ${parsed.data.sort_order})
    RETURNING id, project_id, label, sort_order, created_at, updated_at
  `;
  return c.json({ column_def: rows[0] }, 201);
});

// PATCH /api/v1/projects/:id/column-defs/:defId — update label or sort_order
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
    RETURNING id, project_id, label, sort_order, created_at, updated_at
  `;
  if (!rows[0]) return c.json({ error: 'Not found' }, 404);
  return c.json({ column_def: rows[0] });
});

// DELETE /api/v1/projects/:id/column-defs/:defId — delete a column def
// Note: orphan keys in items.custom_data are ignored at read time (lazy cleanup).
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
  await sql`
    DELETE FROM item_column_defs
    WHERE id = ${defId} AND project_id = ${projectId}
  `;
  return c.body(null, 204);
});

export { router as columnDefsRouter };
