import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { UpdateRoomSchema, CreateItemSchema } from '../types';
import { assertRoomOwnership } from '../lib/ownership';
import { getDb } from '../lib/db';

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
  const rows = await sql`
    SELECT
      i.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', m.id,
            'project_id', m.project_id,
            'name', m.name,
            'material_id', m.material_id,
            'description', m.description,
            'swatch_hex', m.swatch_hex,
            'swatches', COALESCE(
              (
                SELECT array_agg(ms.swatch_hex ORDER BY ms.sort_order)
                FROM material_swatches ms
                WHERE ms.material_id = m.id
              ),
              ARRAY[m.swatch_hex]
            ),
            'created_at', m.created_at,
            'updated_at', m.updated_at
          )
          ORDER BY im.sort_order, lower(m.name)
        )
          FILTER (WHERE m.id IS NOT NULL),
        '[]'::json
      ) AS materials
    FROM items i
    LEFT JOIN item_materials im ON im.item_id = i.id
    LEFT JOIN materials m ON m.id = im.material_id
    WHERE i.room_id = ${id}
    GROUP BY i.id
    ORDER BY i.sort_order, i.created_at
  `;
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
      room_id, item_name, category, vendor, model, item_id_tag,
      dimensions, seat_height, finishes, notes, qty, unit_cost_cents,
      markup_pct, lead_time, status, image_url, link_url, sort_order
    )
    VALUES (
      ${roomId},
      ${parsed.data.item_name},
      ${parsed.data.category},
      ${parsed.data.vendor},
      ${parsed.data.model},
      ${parsed.data.item_id_tag},
      ${parsed.data.dimensions},
      ${parsed.data.seat_height},
      ${parsed.data.finishes},
      ${parsed.data.notes},
      ${parsed.data.qty},
      ${parsed.data.unit_cost_cents},
      ${parsed.data.markup_pct},
      ${parsed.data.lead_time},
      ${parsed.data.status},
      ${parsed.data.image_url},
      ${parsed.data.link_url},
      ${parsed.data.sort_order}
    )
    RETURNING *
  `;
  return c.json({ item: rows[0] }, 201);
});

export { router as roomsRouter };
