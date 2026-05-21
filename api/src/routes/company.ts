import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { UpsertCompanySchema } from '../types';
import { getDb } from '../lib/db';
import { requireAuthorized } from '../middleware/requireAuthorized';

const router = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

// GET /company — returns the caller's company or 404 if none exists yet.
router.get('/', requireAuthorized, async (c) => {
  const uid = c.get('uid');
  const sql = getDb(c.env);
  const rows = await sql`
    SELECT *
    FROM companies
    WHERE owner_uid = ${uid}
    LIMIT 1
  `;
  if (!rows[0]) return c.json({ error: 'Not found' }, 404);
  return c.json({ company: rows[0] });
});

// PUT /company — upsert (create-or-update) the caller's company.
router.put('/', requireAuthorized, async (c) => {
  const uid = c.get('uid');
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = UpsertCompanySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const sql = getDb(c.env);
  const rows = await sql`
    INSERT INTO companies (
      owner_uid, name, location,
      color_primary, color_secondary, color_accent,
      mark_enabled, mark_include_name,
      mark_placement_h, mark_placement_v, mark_opacity
    )
    VALUES (
      ${uid},
      ${parsed.data.name},
      ${parsed.data.location},
      ${parsed.data.color_primary},
      ${parsed.data.color_secondary},
      ${parsed.data.color_accent},
      ${parsed.data.mark_enabled},
      ${parsed.data.mark_include_name},
      ${parsed.data.mark_placement_h},
      ${parsed.data.mark_placement_v},
      ${parsed.data.mark_opacity}
    )
    ON CONFLICT (owner_uid) DO UPDATE SET
      name              = EXCLUDED.name,
      location          = EXCLUDED.location,
      color_primary     = EXCLUDED.color_primary,
      color_secondary   = EXCLUDED.color_secondary,
      color_accent      = EXCLUDED.color_accent,
      mark_enabled      = EXCLUDED.mark_enabled,
      mark_include_name = EXCLUDED.mark_include_name,
      mark_placement_h  = EXCLUDED.mark_placement_h,
      mark_placement_v  = EXCLUDED.mark_placement_v,
      mark_opacity      = EXCLUDED.mark_opacity,
      updated_at        = now()
    RETURNING *
  `;
  return c.json({ company: rows[0] });
});

export { router as companyRouter };
