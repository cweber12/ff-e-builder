import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { CreateProjectSchema, UpdateProjectSchema, CreateRoomSchema } from '../types';
import { assertProjectOwnership } from '../lib/ownership';
import { getDb } from '../lib/db';
import { deleteR2Keys } from '../lib/r2';

const router = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

// GET /api/v1/projects — list caller's projects
router.get('/', async (c) => {
  const uid = c.get('uid');
  const sql = getDb(c.env);
  const rows = await sql`
    SELECT * FROM projects
    WHERE owner_uid = ${uid}
    ORDER BY created_at DESC
  `;
  return c.json({ projects: rows });
});

// POST /api/v1/projects — create a project
router.post('/', async (c) => {
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const uid = c.get('uid');
  const sql = getDb(c.env);
  const rows = await sql`
    INSERT INTO projects (
      owner_uid, name, client_name, company_name, project_location,
      budget_mode, budget_cents, ffe_budget_cents, proposal_budget_cents
    )
    VALUES (
      ${uid},
      ${parsed.data.name},
      ${parsed.data.client_name},
      ${parsed.data.company_name},
      ${parsed.data.project_location},
      ${parsed.data.budget_mode},
      ${parsed.data.budget_cents},
      ${parsed.data.ffe_budget_cents},
      ${parsed.data.proposal_budget_cents}
    )
    RETURNING *
  `;
  return c.json({ project: rows[0] }, 201);
});

// PATCH /api/v1/projects/:id — update a project
router.patch('/:id', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');

  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = UpdateProjectSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    await assertProjectOwnership(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await sql`
    UPDATE projects
    SET
      name         = COALESCE(${parsed.data.name ?? null}, name),
      client_name  = COALESCE(${parsed.data.client_name ?? null}, client_name),
      company_name = COALESCE(${parsed.data.company_name ?? null}, company_name),
      project_location = COALESCE(${parsed.data.project_location ?? null}, project_location),
      budget_mode = COALESCE(${parsed.data.budget_mode ?? null}, budget_mode),
      budget_cents = COALESCE(${parsed.data.budget_cents ?? null}, budget_cents),
      ffe_budget_cents = COALESCE(${parsed.data.ffe_budget_cents ?? null}, ffe_budget_cents),
      proposal_budget_cents = COALESCE(
        ${parsed.data.proposal_budget_cents ?? null},
        proposal_budget_cents
      ),
      proposal_status = COALESCE(${parsed.data.proposal_status ?? null}, proposal_status),
      proposal_status_updated_at = CASE
        WHEN ${parsed.data.proposal_status ?? null} IS NOT NULL THEN NOW()
        ELSE proposal_status_updated_at
      END
    WHERE id = ${id} AND owner_uid = ${uid}
    RETURNING *
  `;
  if (!rows[0]) return c.json({ error: 'Not found' }, 404);
  return c.json({ project: rows[0] });
});

// DELETE /api/v1/projects/:id — delete a project
router.delete('/:id', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');

  try {
    await assertProjectOwnership(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const imageRows = await sql`SELECT r2_key FROM image_assets WHERE project_id = ${id}`;
  await deleteR2Keys(
    c.env.IMAGES_BUCKET,
    (imageRows as { r2_key: string }[]).map((r) => r.r2_key),
  );
  await sql`DELETE FROM projects WHERE id = ${id} AND owner_uid = ${uid}`;
  return c.body(null, 204);
});

// GET /api/v1/projects/:id/rooms — list rooms for a project
router.get('/:id/rooms', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');

  try {
    await assertProjectOwnership(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await sql`
    SELECT * FROM rooms
    WHERE project_id = ${id}
    ORDER BY sort_order, created_at
  `;
  return c.json({ rooms: rows });
});

// POST /api/v1/projects/:id/rooms — create a room in a project
router.post('/:id/rooms', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('id');

  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = CreateRoomSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    await assertProjectOwnership(c.env, projectId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await sql`
    INSERT INTO rooms (project_id, name, sort_order)
    VALUES (${projectId}, ${parsed.data.name}, ${parsed.data.sort_order})
    RETURNING *
  `;
  return c.json({ room: rows[0] }, 201);
});

export { router as projectsRouter };
