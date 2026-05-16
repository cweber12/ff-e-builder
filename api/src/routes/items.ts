import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { UpdateItemSchema } from '../types';
import { assertItemOwnership } from '../lib/ownership';
import { getDb } from '../lib/db';
import { deleteR2Keys } from '../lib/r2';
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
  const imageRows = await sql`
    SELECT r2_key
    FROM image_assets
    WHERE item_id = ${id}
       OR proposal_item_id IN (
         SELECT proposal_item_id
         FROM proposal_item_generated_item_links
         WHERE item_id = ${id}
       )
  `;
  await deleteR2Keys(
    c.env.IMAGES_BUCKET,
    (imageRows as { r2_key: string }[]).map((r) => r.r2_key),
  );
  await sql`
    DELETE FROM proposal_items
    WHERE id IN (
      SELECT proposal_item_id
      FROM proposal_item_generated_item_links
      WHERE item_id = ${id}
    )
  `;
  await sql`DELETE FROM items WHERE id = ${id}`;
  return c.body(null, 204);
});

export { router as itemsRouter };
