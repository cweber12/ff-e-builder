import type { MiddlewareHandler } from 'hono';
import type { Env, HonoVariables } from '../types';
import { verifyFirebaseToken } from '../lib/firebase-auth';

/**
 * Hono middleware that verifies a Firebase ID token from the
 * `Authorization: Bearer <token>` header.
 *
 * On success: sets `c.var.uid` to the authenticated user's Firebase UID.
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
    const { uid } = await verifyFirebaseToken(token, c.env);
    c.set('uid', uid);
    await next();
  } catch {
    return c.json({ error: 'Unauthorized' }, 401);
  }
};
