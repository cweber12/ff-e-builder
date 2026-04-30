import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { UpdateItemSchema } from '../types';
import { assertItemOwnership } from '../lib/ownership';

const router = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

// PATCH /api/v1/items/:id — update an item
router.patch('/:id', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');

  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = UpdateItemSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    await assertItemOwnership(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  // TODO Phase 3: UPDATE items SET ..., version = version + 1 WHERE id = $id
  // Implement optimistic concurrency: accept client-supplied `version` and
  // WHERE version = $client_version — if 0 rows updated, return 409 Conflict.
  return c.json({
    item: {
      id,
      ...parsed.data,
      updated_at: new Date().toISOString(),
    },
  });
});

// DELETE /api/v1/items/:id — delete an item
router.delete('/:id', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');

  try {
    await assertItemOwnership(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  // TODO Phase 3: DELETE FROM items WHERE id = $id
  return c.body(null, 204);
});

export { router as itemsRouter };
