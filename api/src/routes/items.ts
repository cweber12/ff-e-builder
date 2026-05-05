import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { UpdateItemSchema } from '../types';
import { assertItemOwnership } from '../lib/ownership';
import { getDb } from '../lib/db';
import { deleteR2Keys } from '../lib/r2';

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
  // COALESCE(provided ?? null, column) leaves each field unchanged when not included in the patch.
  // Note: explicitly sending null for a nullable field will also leave it unchanged (known limitation).
  const rows = await sql`
    UPDATE items
    SET
      item_name       = COALESCE(${parsed.data.item_name ?? null}, item_name),
      room_id         = COALESCE(${parsed.data.room_id ?? null}, room_id),
      category        = COALESCE(${parsed.data.category ?? null}, category),
      vendor          = COALESCE(${parsed.data.vendor ?? null}, vendor),
      model           = COALESCE(${parsed.data.model ?? null}, model),
      item_id_tag     = COALESCE(${parsed.data.item_id_tag ?? null}, item_id_tag),
      dimensions      = COALESCE(${parsed.data.dimensions ?? null}, dimensions),
      seat_height     = COALESCE(${parsed.data.seat_height ?? null}, seat_height),
      finishes        = COALESCE(${parsed.data.finishes ?? null}, finishes),
      notes           = COALESCE(${parsed.data.notes ?? null}, notes),
      qty             = COALESCE(${parsed.data.qty ?? null}, qty),
      unit_cost_cents = COALESCE(${parsed.data.unit_cost_cents ?? null}, unit_cost_cents),
      markup_pct      = COALESCE(${parsed.data.markup_pct ?? null}, markup_pct),
      lead_time       = COALESCE(${parsed.data.lead_time ?? null}, lead_time),
      status          = COALESCE(${parsed.data.status ?? null}, status),
      image_url       = COALESCE(${parsed.data.image_url ?? null}, image_url),
      link_url        = COALESCE(${parsed.data.link_url ?? null}, link_url),
      sort_order      = COALESCE(${parsed.data.sort_order ?? null}, sort_order),
      version         = version + 1
    WHERE id = ${id} AND version = ${parsed.data.version}
    RETURNING *
  `;
  if (!rows[0]) return c.json({ error: 'Conflict' }, 409);
  return c.json({ item: rows[0] });
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

  const sql = getDb(c.env);
  const imageRows = await sql`SELECT r2_key FROM image_assets WHERE item_id = ${id}`;
  await deleteR2Keys(
    c.env.IMAGES_BUCKET,
    (imageRows as { r2_key: string }[]).map((r) => r.r2_key),
  );
  await sql`DELETE FROM items WHERE id = ${id}`;
  return c.body(null, 204);
});

export { router as itemsRouter };
