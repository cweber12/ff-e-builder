import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { CreateFinishSchema, UpdateFinishSchema } from '../types';
import { assertFinishOwnership, assertProjectOwnership } from '../lib/ownership';
import { getDb } from '../lib/db';
import { deleteR2Keys } from '../lib/r2';
import { generateDefaultFinishName, generateNextCode, selectFinishById } from './materialHelpers';

const DEFAULT_SWATCH = '#D9D4C8';
const router = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

router.get('/:projectId/finishes', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('projectId');
  if (!projectId) return c.json({ error: 'Not found' }, 404);

  try {
    await assertProjectOwnership(c.env, projectId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await sql`
    SELECT * FROM finishes
    WHERE project_id = ${projectId}
    ORDER BY lower(name), created_at
  `;
  return c.json({ finishes: rows });
});

router.post('/:projectId/finishes', async (c) => {
  const uid = c.get('uid');
  const projectId = c.req.param('projectId');
  if (!projectId) return c.json({ error: 'Not found' }, 404);
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = CreateFinishSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    await assertProjectOwnership(c.env, projectId, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const name = parsed.data.name.trim() || (await generateDefaultFinishName(sql, projectId));
  const code = parsed.data.code.trim() || (await generateNextCode(sql, 'finishes', projectId));
  const rows = await sql`
    INSERT INTO finishes (
      project_id, code, name, description, swatch_hex, manufacturer, source_url,
      category, sub_category
    )
    VALUES (
      ${projectId},
      ${code},
      ${name},
      ${parsed.data.description},
      ${parsed.data.swatch_hex ?? DEFAULT_SWATCH},
      ${parsed.data.manufacturer},
      ${parsed.data.source_url},
      ${parsed.data.category ?? null},
      ${parsed.data.sub_category ?? ''}
    )
    ON CONFLICT (project_id, (lower(name)))
    DO UPDATE SET
      code         = COALESCE(NULLIF(EXCLUDED.code, ''),         finishes.code),
      description  = COALESCE(NULLIF(EXCLUDED.description, ''),  finishes.description),
      swatch_hex   = EXCLUDED.swatch_hex,
      manufacturer = COALESCE(NULLIF(EXCLUDED.manufacturer, ''), finishes.manufacturer),
      source_url   = COALESCE(NULLIF(EXCLUDED.source_url, ''),   finishes.source_url),
      category     = EXCLUDED.category,
      sub_category = EXCLUDED.sub_category
    RETURNING *
  `.catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('finishes_project_code_idx')) {
      throw Object.assign(new Error('code_conflict'), { isCodeConflict: true });
    }
    throw err;
  });

  if (!rows[0]) return c.json({ error: 'Not found' }, 404);
  const finish = rows[0] as { id: string };
  return c.json({ finish: await selectFinishById(sql, finish.id) }, 201);
});

router.patch('/finishes/:id', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = UpdateFinishSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    await assertFinishOwnership(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const rows = await sql`
    UPDATE finishes
    SET
      code         = COALESCE(${parsed.data.code ?? null},         code),
      name         = COALESCE(${parsed.data.name ?? null},         name),
      description  = COALESCE(${parsed.data.description ?? null},  description),
      swatch_hex   = COALESCE(${parsed.data.swatch_hex ?? null},   swatch_hex),
      manufacturer = COALESCE(${parsed.data.manufacturer ?? null}, manufacturer),
      source_url   = COALESCE(${parsed.data.source_url ?? null},   source_url),
      category     = ${parsed.data.category ?? null},
      sub_category = ${parsed.data.sub_category ?? ''}
    WHERE id = ${id}
    RETURNING *
  `.catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('finishes_project_code_idx')) {
      throw Object.assign(new Error('code_conflict'), { isCodeConflict: true });
    }
    throw err;
  });

  if (!rows[0]) return c.json({ error: 'Not found' }, 404);
  return c.json({ finish: await selectFinishById(sql, id) });
});

router.delete('/finishes/:id', async (c) => {
  const uid = c.get('uid');
  const id = c.req.param('id');

  try {
    await assertFinishOwnership(c.env, id, uid);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }

  const sql = getDb(c.env);
  const imageRows = await sql`SELECT r2_key FROM image_assets WHERE finish_id = ${id}`;
  await deleteR2Keys(
    c.env.IMAGES_BUCKET,
    (imageRows as { r2_key: string }[]).map((r) => r.r2_key),
  );
  await sql`DELETE FROM finishes WHERE id = ${id}`;
  return c.body(null, 204);
});

export { router as finishesRouter };
