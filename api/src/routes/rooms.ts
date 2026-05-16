import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { UpdateRoomSchema, CreateItemSchema } from '../types';
import { assertRoomOwnership } from '../lib/ownership';
import { getDb } from '../lib/db';
import { deleteR2Keys } from '../lib/r2';
import { selectGeneratedItemsByRoom } from '../lib/generatedItems';

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
  return c.json({ room: rows[0] });
});

// DELETE /api/v1/rooms/:id — delete a room (cascades to items)
router.delete('/:id', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');

  try {
    await assertRoomOwnership(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  // room_id is stored on both room images and item images (items carry their room's id)
  // so this single query covers the full cascade scope
  const imageRows = await sql`SELECT r2_key FROM image_assets WHERE room_id = ${id}`;
  await deleteR2Keys(
    c.env.IMAGES_BUCKET,
    (imageRows as { r2_key: string }[]).map((r) => r.r2_key),
  );
  await sql`DELETE FROM rooms WHERE id = ${id}`;
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
  const rows = await sql`
    INSERT INTO items (
      room_id, item_name, description, category, item_id_tag,
      dimensions, notes, qty, unit_cost_cents,
      lead_time, status, custom_data, sort_order
    )
    VALUES (
      ${roomId},
      ${parsed.data.item_name},
      ${parsed.data.description},
      ${parsed.data.category},
      ${parsed.data.item_id_tag},
      ${parsed.data.dimensions},
      ${parsed.data.notes},
      ${parsed.data.qty},
      ${parsed.data.unit_cost_cents},
      ${parsed.data.lead_time},
      ${parsed.data.status},
      ${JSON.stringify(parsed.data.custom_data)},
      ${parsed.data.sort_order}
    )
    RETURNING *
  `;
  return c.json({ item: rows[0] }, 201);
});

export { router as roomsRouter };
