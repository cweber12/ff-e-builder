import type { Env } from '../types';
import { getDb } from './db';

/**
 * Asserts that the given user owns the project.
 * Throws if no matching row is found (caller converts to 404).
 * Returns 404 — NOT 403 — to avoid leaking resource existence.
 */
export async function assertProjectOwnership(
  env: Env,
  projectId: string,
  uid: string,
): Promise<void> {
  const sql = getDb(env);
  const rows = await sql`
    SELECT 1
    FROM projects
    WHERE id = ${projectId} AND owner_uid = ${uid}
    LIMIT 1
  `;
  if (rows.length === 0) throw new Error('not_found');
}

/**
 * Asserts that the given user owns the project that contains the room.
 * Throws if no matching row is found.
 */
export async function assertRoomOwnership(env: Env, roomId: string, uid: string): Promise<void> {
  const sql = getDb(env);
  const rows = await sql`
    SELECT 1
    FROM rooms r
    JOIN projects p ON r.project_id = p.id
    WHERE r.id = ${roomId} AND p.owner_uid = ${uid}
    LIMIT 1
  `;
  if (rows.length === 0) throw new Error('not_found');
}

/**
 * Asserts that the given user owns the project that contains the item.
 * Throws if no matching row is found.
 */
export async function assertItemOwnership(env: Env, itemId: string, uid: string): Promise<void> {
  const sql = getDb(env);
  const rows = await sql`
    SELECT 1
    FROM items i
    JOIN rooms r ON i.room_id = r.id
    JOIN projects p ON r.project_id = p.id
    WHERE i.id = ${itemId} AND p.owner_uid = ${uid}
    LIMIT 1
  `;
  if (rows.length === 0) throw new Error('not_found');
}
