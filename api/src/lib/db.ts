import { neon } from '@neondatabase/serverless';
import type { Env } from '../types';

/**
 * Returns a Neon tagged-template-literal SQL function bound to the
 * Worker's NEON_DATABASE_URL secret.
 *
 * Uses HTTP transport — no WebSocket setup needed.
 * Call once per request; do NOT cache across requests (Workers isolate
 * per-request execution context).
 */
export function getDb(env: Env) {
  return neon(env.NEON_DATABASE_URL);
}
