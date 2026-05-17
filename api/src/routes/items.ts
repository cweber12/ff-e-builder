import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { UpdateItemSchema } from '../types';
import { assertItemOwnership } from '../lib/ownership';
import { getDb } from '../lib/db';
import { updateGeneratedItemFromFfe } from '../lib/generatedItems';

const router = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

// PATCH /api/v1/items/:id — update an item with optimistic concurrency
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

  const sql = getDb(c.env);
  const item = await updateGeneratedItemFromFfe(sql, id, parsed.data);
  if (!item) return c.json({ error: 'Conflict' }, 409);
  return c.json({ item });
});

// DELETE /api/v1/items/:id — remove an item from the FF&E view.
// Generated Items stay in storage and remain visible in Proposal.
router.delete('/:id', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');

  try {
    await assertItemOwnership(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await sql`
    UPDATE items
    SET is_ffe_visible = false,
        version = version + 1
    WHERE id = ${id}
    RETURNING id
  `;
  if (!rows[0]) return c.json({ error: 'Not found' }, 404);
  return c.body(null, 204);
});

export { router as itemsRouter };
