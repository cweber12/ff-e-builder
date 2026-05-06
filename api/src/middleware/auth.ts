import type { MiddlewareHandler } from 'hono';
import type { Env, HonoVariables } from '../types';
import { verifyFirebaseToken } from '../lib/firebase-auth';

/**
 * Hono middleware that verifies a Firebase ID token from the
 * `Authorization: Bearer <token>` header.
 *
 * On success: sets `c.var.uid`, `c.var.email`, and `c.var.isAuthorized`.
 * On failure: returns 401 Unauthorized.
 */
export const authMiddleware: MiddlewareHandler<{
  Bindings: Env;
  Variables: HonoVariables;
}> = async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = header.slice(7);
  try {
    const { uid, email } = await verifyFirebaseToken(token, c.env);

    const raw = c.env.AUTHORIZED_EMAILS ?? '';
    const allowlist = raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const isAuthorized =
      allowlist.length > 0 && email !== null && allowlist.includes(email.toLowerCase());

    c.set('uid', uid);
    c.set('email', email);
    c.set('isAuthorized', isAuthorized);
    await next();
  } catch {
    return c.json({ error: 'Unauthorized' }, 401);
  }
};
