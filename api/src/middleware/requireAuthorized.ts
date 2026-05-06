import type { MiddlewareHandler } from 'hono';
import type { Env, HonoVariables } from '../types';

/**
 * Hono middleware that blocks any user not on the AUTHORIZED_EMAILS allowlist.
 * Must be applied after authMiddleware (which sets isAuthorized on context).
 */
export const requireAuthorized: MiddlewareHandler<{
  Bindings: Env;
  Variables: HonoVariables;
}> = async (c, next) => {
  if (!c.get('isAuthorized')) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  return next();
};
