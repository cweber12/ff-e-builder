import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { UpsertUserProfileSchema } from '../types';
import { getDb } from '../lib/db';
import { requireAuthorized } from '../middleware/requireAuthorized';

const router = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

// GET /me — available to all authenticated users; skips Neon for unauthorized ones.
router.get('/me', async (c) => {
  const uid = c.get('uid');
  const isAuthorized = c.get('isAuthorized');

  if (!isAuthorized) {
    return c.json({
      authorized: false,
      profile: {
        owner_uid: uid,
        name: '',
        email: c.get('email') ?? '',
        phone: '',
        company_name: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
  }

  const sql = getDb(c.env);
  const rows = await sql`
    SELECT *
    FROM user_profiles
    WHERE owner_uid = ${uid}
    LIMIT 1
  `;

  return c.json({
    authorized: true,
    profile:
      rows[0] ??
      ({
        owner_uid: uid,
        name: '',
        email: '',
        phone: '',
        company_name: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } satisfies Record<string, string>),
  });
});

// PUT /me — authorized users only.
router.put('/me', requireAuthorized, async (c) => {
  const uid = c.get('uid');
  const body = await c.req.json<unknown>().catch(() => null);
  const parsed = UpsertUserProfileSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const sql = getDb(c.env);
  const rows = await sql`
    INSERT INTO user_profiles (owner_uid, name, email, phone, company_name)
    VALUES (
      ${uid},
      ${parsed.data.name},
      ${parsed.data.email},
      ${parsed.data.phone},
      ${parsed.data.company_name}
    )
    ON CONFLICT (owner_uid) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      company_name = EXCLUDED.company_name
    RETURNING *
  `;

  return c.json({ authorized: true, profile: rows[0] });
});

export { router as usersRouter };
