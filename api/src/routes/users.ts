import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { UpsertUserProfileSchema } from '../types';
import { getDb } from '../lib/db';

const router = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

router.get('/me', async (c) => {
  const uid = c.get('uid');
  const sql = getDb(c.env);
  const rows = await sql`
    SELECT *
    FROM user_profiles
    WHERE owner_uid = ${uid}
    LIMIT 1
  `;

  return c.json({
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

router.put('/me', async (c) => {
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

  return c.json({ profile: rows[0] });
});

export { router as usersRouter };
