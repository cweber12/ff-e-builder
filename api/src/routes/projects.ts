import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { CreateProjectSchema, UpdateProjectSchema } from '../types';
import { assertProjectOwnership } from '../lib/ownership';

const router = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

// GET /api/v1/projects — list caller's projects
router.get('/', (c) => {
  // TODO Phase 3: SELECT * FROM projects WHERE owner_uid = $uid ORDER BY created_at DESC
  return c.json({ projects: [] });
});

// POST /api/v1/projects — create a project
router.post('/', async (c) => {
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const uid = c.get('uid');
  // TODO Phase 3: INSERT INTO projects (owner_uid, name, client_name, budget_cents)
  return c.json(
    {
      project: {
        id: '00000000-0000-0000-0000-000000000000',
        owner_uid: uid,
        ...parsed.data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
    201,
  );
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

  // TODO Phase 3: UPDATE projects SET ... WHERE id = $id AND owner_uid = $uid
  return c.json({
    project: {
      id,
      owner_uid: uid,
      ...parsed.data,
      updated_at: new Date().toISOString(),
    },
  });
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

  // TODO Phase 3: DELETE FROM projects WHERE id = $id AND owner_uid = $uid
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

  // TODO Phase 3: SELECT * FROM rooms WHERE project_id = $id ORDER BY sort_order
  return c.json({ rooms: [] });
});

// POST /api/v1/projects/:id/rooms — create a room in a project
router.post('/:id/rooms', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('id');

  const body = await c.req.json<unknown>().catch(() => null);

  const { CreateRoomSchema } = await import('../types');
  const parsed = CreateRoomSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    await assertProjectOwnership(c.env, projectId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  // TODO Phase 3: INSERT INTO rooms (project_id, name, sort_order)
  return c.json(
    {
      room: {
        id: '00000000-0000-0000-0000-000000000000',
        project_id: projectId,
        ...parsed.data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
    201,
  );
});

export { router as projectsRouter };
