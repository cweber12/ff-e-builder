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

export async function getOwnedProjectContext(
  env: Env,
  projectId: string,
  uid: string,
): Promise<{ projectId: string }> {
  const sql = getDb(env);
  const rows = await sql`
    SELECT id
    FROM projects
    WHERE id = ${projectId} AND owner_uid = ${uid}
    LIMIT 1
  `;
  const row = rows[0] as { id?: string } | undefined;
  if (!row?.id) throw new Error('not_found');
  return { projectId: row.id };
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

export async function getOwnedRoomContext(
  env: Env,
  roomId: string,
  uid: string,
): Promise<{ projectId: string; roomId: string }> {
  const sql = getDb(env);
  const rows = await sql`
    SELECT r.id AS room_id, r.project_id
    FROM rooms r
    JOIN projects p ON r.project_id = p.id
    WHERE r.id = ${roomId} AND p.owner_uid = ${uid}
    LIMIT 1
  `;
  const row = rows[0] as { room_id?: string; project_id?: string } | undefined;
  if (!row?.room_id || !row.project_id) throw new Error('not_found');
  return { projectId: row.project_id, roomId: row.room_id };
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

export async function getOwnedItemContext(
  env: Env,
  itemId: string,
  uid: string,
): Promise<{ projectId: string; roomId: string; itemId: string }> {
  const sql = getDb(env);
  const rows = await sql`
    SELECT i.id AS item_id, i.room_id, r.project_id
    FROM items i
    JOIN rooms r ON i.room_id = r.id
    JOIN projects p ON r.project_id = p.id
    WHERE i.id = ${itemId} AND p.owner_uid = ${uid}
    LIMIT 1
  `;
  const row = rows[0] as { item_id?: string; room_id?: string; project_id?: string } | undefined;
  if (!row?.item_id || !row.room_id || !row.project_id) throw new Error('not_found');
  return { projectId: row.project_id, roomId: row.room_id, itemId: row.item_id };
}

export async function assertMaterialOwnership(
  env: Env,
  materialId: string,
  uid: string,
): Promise<void> {
  const sql = getDb(env);
  const rows = await sql`
    SELECT 1
    FROM materials m
    JOIN projects p ON m.project_id = p.id
    WHERE m.id = ${materialId} AND p.owner_uid = ${uid}
    LIMIT 1
  `;
  if (rows.length === 0) throw new Error('not_found');
}

export async function getOwnedMaterialContext(
  env: Env,
  materialId: string,
  uid: string,
): Promise<{ projectId: string; materialId: string }> {
  const sql = getDb(env);
  const rows = await sql`
    SELECT m.id AS material_id, m.project_id
    FROM materials m
    JOIN projects p ON m.project_id = p.id
    WHERE m.id = ${materialId} AND p.owner_uid = ${uid}
    LIMIT 1
  `;
  const row = rows[0] as { material_id?: string; project_id?: string } | undefined;
  if (!row?.material_id || !row.project_id) throw new Error('not_found');
  return { projectId: row.project_id, materialId: row.material_id };
}

export async function assertTakeoffCategoryOwnership(
  env: Env,
  categoryId: string,
  uid: string,
): Promise<void> {
  const sql = getDb(env);
  const rows = await sql`
    SELECT 1
    FROM takeoff_categories c
    JOIN projects p ON c.project_id = p.id
    WHERE c.id = ${categoryId} AND p.owner_uid = ${uid}
    LIMIT 1
  `;
  if (rows.length === 0) throw new Error('not_found');
}

export async function assertTakeoffItemOwnership(
  env: Env,
  itemId: string,
  uid: string,
): Promise<void> {
  const sql = getDb(env);
  const rows = await sql`
    SELECT 1
    FROM takeoff_items i
    JOIN takeoff_categories c ON i.category_id = c.id
    JOIN projects p ON c.project_id = p.id
    WHERE i.id = ${itemId} AND p.owner_uid = ${uid}
    LIMIT 1
  `;
  if (rows.length === 0) throw new Error('not_found');
}

export async function getOwnedTakeoffItemContext(
  env: Env,
  itemId: string,
  uid: string,
): Promise<{ projectId: string; takeoffItemId: string }> {
  const sql = getDb(env);
  const rows = await sql`
    SELECT i.id AS takeoff_item_id, c.project_id
    FROM takeoff_items i
    JOIN takeoff_categories c ON i.category_id = c.id
    JOIN projects p ON c.project_id = p.id
    WHERE i.id = ${itemId} AND p.owner_uid = ${uid}
    LIMIT 1
  `;
  const row = rows[0] as { takeoff_item_id?: string; project_id?: string } | undefined;
  if (!row?.takeoff_item_id || !row.project_id) throw new Error('not_found');
  return { projectId: row.project_id, takeoffItemId: row.takeoff_item_id };
}
