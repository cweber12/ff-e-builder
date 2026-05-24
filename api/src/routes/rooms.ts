import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { UpdateRoomSchema, CreateItemSchema, ReorderItemsSchema } from '../types';
import { assertRoomOwnership } from '../lib/ownership';
import { getDb } from '../lib/db';
import {
  createGeneratedItemFromFfe,
  selectGeneratedItemsByRoom,
  syncFfeLocationNameToLinkedProposalItems,
} from '../lib/generatedItems';

const router = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

// PATCH /api/v1/rooms/:id — update a room
router.patch('/:id', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');

  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = UpdateRoomSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    await assertRoomOwnership(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await sql`
    UPDATE rooms
    SET
      name       = COALESCE(${parsed.data.name ?? null}, name),
      sort_order = COALESCE(${parsed.data.sort_order ?? null}, sort_order)
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows[0]) return c.json({ error: 'Not found' }, 404);
  if (parsed.data.name != null) {
    const room = rows[0] as { name?: string };
    await syncFfeLocationNameToLinkedProposalItems(sql, id, room.name ?? parsed.data.name);
  }
  return c.json({ room: rows[0] });
});

// DELETE /api/v1/rooms/:id — remove a Location from the FF&E view.
// The room row, generated items, linked Proposal rows, and images remain.
router.delete('/:id', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');

  try {
    await assertRoomOwnership(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  await sql`
    UPDATE items
    SET is_ffe_visible = false,
        version = version + 1
    WHERE room_id = ${id}
  `;
  const rows = await sql`
    UPDATE rooms
    SET is_ffe_visible = false
    WHERE id = ${id}
    RETURNING id
  `;
  if (!rows[0]) return c.json({ error: 'Not found' }, 404);
  return c.body(null, 204);
});

// GET /api/v1/rooms/:id/items — list items in a room
router.get('/:id/items', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');

  try {
    await assertRoomOwnership(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await selectGeneratedItemsByRoom(sql, id);
  return c.json({ items: rows });
});

// POST /api/v1/rooms/:id/items — create an item in a room
router.post('/:id/items', async (c) => {
  const uid = c.get('uid');
  const roomId = c.req.param('id');

  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = CreateItemSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    await assertRoomOwnership(c.env, roomId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const item = await createGeneratedItemFromFfe(sql, roomId, parsed.data);
  return c.json({ item }, 201);
});

// POST /api/v1/rooms/:id/reorder — atomically reorder all items in a room
router.post('/:id/reorder', async (c) => {
  const uid = c.get('uid');
  const roomId = c.req.param('id');

  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = ReorderItemsSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    await assertRoomOwnership(c.env, roomId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const { orderedItemIds } = parsed.data;
  const sql = getDb(c.env);
  await sql`
    UPDATE items
    SET sort_order = v.idx
    FROM (
      SELECT id, (ordinality - 1)::int AS idx
      FROM unnest(${orderedItemIds}::uuid[]) WITH ORDINALITY AS t(id, ordinality)
    ) v
    WHERE items.id = v.id
      AND items.room_id = ${roomId}
  `;
  return c.json({ ok: true });
});

export { router as roomsRouter };
