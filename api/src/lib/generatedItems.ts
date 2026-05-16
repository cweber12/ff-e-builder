import type { getDb } from './db';
import type { CreateItemInput, CreateProposalItemInput, UpdateItemInput } from '../types';

type Sql = ReturnType<typeof getDb>;
type DbRow = Record<string, unknown>;

async function selectRoomProjectId(sql: Sql, roomId: string) {
  const rows = await sql`
    SELECT project_id
    FROM rooms
    WHERE id = ${roomId}
    LIMIT 1
  `;
  const row = rows[0] as { project_id?: string } | undefined;
  if (!row?.project_id) throw new Error('room_not_found');
  return row.project_id;
}

async function selectProposalCategoryProjectId(sql: Sql, categoryId: string) {
  const rows = await sql`
    SELECT project_id
    FROM proposal_categories
    WHERE id = ${categoryId}
    LIMIT 1
  `;
  const row = rows[0] as { project_id?: string } | undefined;
  if (!row?.project_id) throw new Error('proposal_category_not_found');
  return row.project_id;
}

async function selectDefaultFurnitureCategoryId(sql: Sql, projectId: string) {
  const rows = await sql`
    WITH existing AS (
      SELECT id
      FROM proposal_categories
      WHERE project_id = ${projectId} AND lower(name) = 'furniture'
      ORDER BY sort_order, created_at
      LIMIT 1
    ),
    inserted AS (
      INSERT INTO proposal_categories (project_id, name, sort_order)
      SELECT ${projectId}, 'Furniture', 0
      WHERE NOT EXISTS (SELECT 1 FROM existing)
      RETURNING id
    )
    SELECT id FROM inserted
    UNION ALL
    SELECT id FROM existing
    LIMIT 1
  `;
  const row = rows[0] as { id?: string } | undefined;
  if (!row?.id) throw new Error('furniture_category_not_found');
  return row.id;
}

async function selectDefaultUnassignedRoomId(sql: Sql, projectId: string) {
  const rows = await sql`
    WITH existing AS (
      SELECT id
      FROM rooms
      WHERE project_id = ${projectId} AND lower(name) = 'unassigned'
      ORDER BY sort_order, created_at
      LIMIT 1
    ),
    inserted AS (
      INSERT INTO rooms (project_id, name, sort_order)
      SELECT ${projectId}, 'Unassigned', 0
      WHERE NOT EXISTS (SELECT 1 FROM existing)
      RETURNING id
    )
    SELECT id FROM inserted
    UNION ALL
    SELECT id FROM existing
    LIMIT 1
  `;
  const row = rows[0] as { id?: string } | undefined;
  if (!row?.id) throw new Error('unassigned_room_not_found');
  return row.id;
}

async function insertProposalItemMirrorForGeneratedItem(
  sql: Sql,
  itemId: string,
  categoryId: string,
  input: CreateItemInput,
) {
  const rows = await sql`
    INSERT INTO proposal_items (
      category_id, product_tag, plan, drawings, location, description, notes,
      size_label, size_mode, size_w, size_d, size_h, size_unit,
      cbm, quantity, quantity_unit, unit_cost_cents, sort_order, custom_data
    )
    VALUES (
      ${categoryId},
      ${input.item_id_tag ?? ''},
      '',
      '',
      '',
      ${input.item_name},
      ${input.notes ?? ''},
      ${input.dimensions ?? ''},
      'imperial',
      '',
      '',
      '',
      'in',
      0,
      ${input.qty ?? 1},
      'unit',
      ${input.unit_cost_cents ?? 0},
      ${input.sort_order ?? 0},
      ${JSON.stringify(input.custom_data ?? {})}
    )
    RETURNING id
  `;
  const row = rows[0] as { id?: string } | undefined;
  if (!row?.id) throw new Error('proposal_item_mirror_not_created');

  await sql`
    INSERT INTO proposal_item_generated_item_links (proposal_item_id, item_id)
    VALUES (${row.id}, ${itemId})
    ON CONFLICT (proposal_item_id) DO NOTHING
  `;
}

async function insertGeneratedItemMirrorForProposalItem(
  sql: Sql,
  proposalItemId: string,
  roomId: string,
  categoryId: string,
  input: CreateProposalItemInput,
) {
  const rows = await sql`
    INSERT INTO items (
      room_id, item_name, description, category, item_id_tag,
      dimensions, notes, qty, unit_cost_cents,
      lead_time, status, custom_data, sort_order,
      proposal_category_id, product_tag, plan, drawings, location,
      size_label, size_mode, size_w, size_d, size_h, size_unit,
      cbm, quantity, quantity_unit
    )
    VALUES (
      ${roomId},
      COALESCE(NULLIF(${input.description ?? ''}, ''), NULLIF(${input.product_tag ?? ''}, ''), 'Proposal item'),
      NULLIF(${input.description ?? ''}, ''),
      NULL,
      NULLIF(${input.product_tag ?? ''}, ''),
      NULLIF(${input.size_label ?? ''}, ''),
      NULLIF(${input.notes ?? ''}, ''),
      GREATEST(0, CEIL(${input.quantity ?? 1}))::int,
      ${input.unit_cost_cents ?? 0},
      NULL,
      'pending',
      ${JSON.stringify(input.custom_data ?? {})},
      ${input.sort_order ?? 0},
      ${categoryId},
      ${input.product_tag ?? ''},
      ${input.plan ?? ''},
      ${input.drawings ?? ''},
      ${input.location ?? ''},
      ${input.size_label ?? ''},
      ${input.size_mode ?? 'imperial'},
      ${input.size_w ?? ''},
      ${input.size_d ?? ''},
      ${input.size_h ?? ''},
      ${input.size_unit ?? 'in'},
      ${input.cbm ?? 0},
      ${input.quantity ?? 1},
      ${input.quantity_unit ?? 'unit'}
    )
    RETURNING id
  `;
  const row = rows[0] as { id?: string } | undefined;
  if (!row?.id) throw new Error('generated_item_mirror_not_created');

  await sql`
    INSERT INTO proposal_item_generated_item_links (proposal_item_id, item_id)
    VALUES (${proposalItemId}, ${row.id})
    ON CONFLICT (proposal_item_id) DO NOTHING
  `;
}

export async function createGeneratedItemFromFfe(sql: Sql, roomId: string, input: CreateItemInput) {
  const projectId = await selectRoomProjectId(sql, roomId);
  const furnitureCategoryId = await selectDefaultFurnitureCategoryId(sql, projectId);
  const rows = await sql`
    INSERT INTO items (
      room_id, item_name, description, category, item_id_tag,
      dimensions, notes, qty, unit_cost_cents,
      lead_time, status, custom_data, sort_order,
      proposal_category_id, product_tag, quantity, quantity_unit
    )
    VALUES (
      ${roomId},
      ${input.item_name},
      ${input.description},
      ${input.category},
      ${input.item_id_tag},
      ${input.dimensions},
      ${input.notes},
      ${input.qty ?? 1},
      ${input.unit_cost_cents ?? 0},
      ${input.lead_time},
      ${input.status ?? 'pending'},
      ${JSON.stringify(input.custom_data ?? {})},
      ${input.sort_order ?? 0},
      ${furnitureCategoryId},
      ${input.item_id_tag ?? ''},
      ${input.qty ?? 1},
      'unit'
    )
    RETURNING *
  `;
  const item = rows[0] as { id?: string } | undefined;
  if (!item?.id) throw new Error('generated_item_not_created');

  await insertProposalItemMirrorForGeneratedItem(sql, item.id, furnitureCategoryId, input);
  return rows[0] as DbRow;
}

export async function createGeneratedItemFromProposal(
  sql: Sql,
  categoryId: string,
  input: CreateProposalItemInput,
) {
  const projectId = await selectProposalCategoryProjectId(sql, categoryId);
  const unassignedRoomId = await selectDefaultUnassignedRoomId(sql, projectId);
  const rows = await sql`
    INSERT INTO proposal_items (
      category_id, product_tag, plan, drawings, location, description, notes,
      size_label, size_mode, size_w, size_d, size_h, size_unit,
      cbm, quantity, quantity_unit, unit_cost_cents, sort_order, custom_data
    )
    VALUES (
      ${categoryId},
      ${input.product_tag ?? ''},
      ${input.plan ?? ''},
      ${input.drawings ?? ''},
      ${input.location ?? ''},
      ${input.description ?? ''},
      ${input.notes ?? ''},
      ${input.size_label ?? ''},
      ${input.size_mode ?? 'imperial'},
      ${input.size_w ?? ''},
      ${input.size_d ?? ''},
      ${input.size_h ?? ''},
      ${input.size_unit ?? 'in'},
      ${input.cbm ?? 0},
      ${input.quantity ?? 1},
      ${input.quantity_unit ?? 'unit'},
      ${input.unit_cost_cents ?? 0},
      ${input.sort_order ?? 0},
      ${JSON.stringify(input.custom_data ?? {})}
    )
    RETURNING *
  `;
  const proposalItem = rows[0] as { id?: string } | undefined;
  if (!proposalItem?.id) throw new Error('proposal_item_not_created');

  await insertGeneratedItemMirrorForProposalItem(
    sql,
    proposalItem.id,
    unassignedRoomId,
    categoryId,
    input,
  );
  return rows[0] as DbRow;
}

export async function mirrorGeneratedItemToProposalItem(sql: Sql, itemId: string) {
  await sql`
    UPDATE proposal_items pi
    SET
      category_id      = i.proposal_category_id,
      product_tag      = COALESCE(i.product_tag, ''),
      description      = i.item_name,
      notes            = COALESCE(i.notes, ''),
      size_label       = COALESCE(i.dimensions, ''),
      quantity         = i.qty::numeric,
      quantity_unit    = 'unit',
      unit_cost_cents  = i.unit_cost_cents,
      sort_order       = i.sort_order,
      custom_data      = i.custom_data,
      version          = pi.version + 1
    FROM proposal_item_generated_item_links link
    JOIN items i ON i.id = link.item_id
    WHERE pi.id = link.proposal_item_id
      AND link.item_id = ${itemId}
      AND i.proposal_category_id IS NOT NULL
  `;
}

export async function mirrorProposalItemToGeneratedItem(sql: Sql, proposalItemId: string) {
  await sql`
    UPDATE items i
    SET
      proposal_category_id = pi.category_id,
      item_name            = COALESCE(NULLIF(pi.description, ''), NULLIF(pi.product_tag, ''), i.item_name),
      description          = NULLIF(pi.description, ''),
      item_id_tag          = NULLIF(pi.product_tag, ''),
      product_tag          = pi.product_tag,
      dimensions           = NULLIF(pi.size_label, ''),
      notes                = NULLIF(pi.notes, ''),
      qty                  = GREATEST(0, CEIL(pi.quantity))::int,
      unit_cost_cents      = pi.unit_cost_cents,
      custom_data          = pi.custom_data,
      sort_order           = pi.sort_order,
      plan                 = pi.plan,
      drawings             = pi.drawings,
      location             = pi.location,
      size_label           = pi.size_label,
      size_mode            = pi.size_mode,
      size_w               = pi.size_w,
      size_d               = pi.size_d,
      size_h               = pi.size_h,
      size_unit            = pi.size_unit,
      cbm                  = pi.cbm,
      quantity             = pi.quantity,
      quantity_unit        = pi.quantity_unit,
      version              = i.version + 1
    FROM proposal_item_generated_item_links link
    JOIN proposal_items pi ON pi.id = link.proposal_item_id
    WHERE i.id = link.item_id
      AND link.proposal_item_id = ${proposalItemId}
  `;
}

export async function updateGeneratedItemFromFfe(sql: Sql, itemId: string, input: UpdateItemInput) {
  // COALESCE(provided ?? null, column) leaves each field unchanged when not included in the patch.
  // Note: explicitly sending null for a nullable field will also leave it unchanged (known limitation).
  const rows = await sql`
    UPDATE items
    SET
      item_name       = COALESCE(${input.item_name ?? null}, item_name),
      room_id         = COALESCE(${input.room_id ?? null}, room_id),
      description     = COALESCE(${input.description ?? null}, description),
      category        = COALESCE(${input.category ?? null}, category),
      item_id_tag     = COALESCE(${input.item_id_tag ?? null}, item_id_tag),
      product_tag     = COALESCE(${input.item_id_tag ?? null}, product_tag),
      dimensions      = COALESCE(${input.dimensions ?? null}, dimensions),
      notes           = COALESCE(${input.notes ?? null}, notes),
      qty             = COALESCE(${input.qty ?? null}, qty),
      quantity        = COALESCE(${input.qty ?? null}, quantity),
      quantity_unit   = CASE WHEN ${input.qty != null}::boolean THEN 'unit' ELSE quantity_unit END,
      unit_cost_cents = COALESCE(${input.unit_cost_cents ?? null}, unit_cost_cents),
      lead_time       = COALESCE(${input.lead_time ?? null}, lead_time),
      status          = COALESCE(${input.status ?? null}, status),
      custom_data     = CASE
                          WHEN ${input.custom_data != null}::boolean
                          THEN custom_data || ${JSON.stringify(input.custom_data ?? {})}::jsonb
                          ELSE custom_data
                        END,
      sort_order      = COALESCE(${input.sort_order ?? null}, sort_order),
      version         = version + 1
    WHERE id = ${itemId} AND version = ${input.version}
    RETURNING *
  `;
  if (rows[0]) await mirrorGeneratedItemToProposalItem(sql, itemId);
  return rows[0] as DbRow | undefined;
}

export async function selectGeneratedItemsByRoom(sql: Sql, roomId: string) {
  return sql`
    SELECT
      i.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', m.id,
            'project_id', m.project_id,
            'name', m.name,
            'material_id', m.material_id,
            'description', m.description,
            'swatch_hex', m.swatch_hex,
            'created_at', m.created_at,
            'updated_at', m.updated_at
          )
          ORDER BY im.sort_order, lower(m.name)
        )
          FILTER (WHERE m.id IS NOT NULL),
        '[]'::json
      ) AS materials
    FROM items i
    LEFT JOIN item_materials im ON im.item_id = i.id
    LEFT JOIN materials m ON m.id = im.material_id
    WHERE i.room_id = ${roomId}
    GROUP BY i.id
    ORDER BY i.sort_order, i.created_at
  `;
}

export async function selectGeneratedItemsByProposalCategory(sql: Sql, categoryId: string) {
  // Canonical items cover migrated/shared rows; unlinked proposal_items preserve
  // current Proposal writes until the write bridge lands in a later slice.
  return sql`
    WITH canonical_items AS (
      SELECT
        i.id,
        i.proposal_category_id AS category_id,
        COALESCE(NULLIF(i.product_tag, ''), i.item_id_tag, '') AS product_tag,
        i.plan,
        i.drawings,
        i.location,
        COALESCE(NULLIF(i.description, ''), i.item_name, '') AS description,
        COALESCE(i.notes, '') AS notes,
        i.size_label,
        i.size_mode,
        i.size_w,
        i.size_d,
        i.size_h,
        i.size_unit,
        i.cbm,
        i.quantity,
        i.quantity_unit,
        i.unit_cost_cents,
        i.sort_order,
        i.custom_data,
        i.version,
        i.created_at,
        i.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', m.id,
              'project_id', m.project_id,
              'name', m.name,
              'material_id', m.material_id,
              'description', m.description,
              'swatch_hex', m.swatch_hex,
              'created_at', m.created_at,
              'updated_at', m.updated_at
            )
            ORDER BY generated_materials.sort_order, lower(m.name)
          )
            FILTER (WHERE m.id IS NOT NULL),
          '[]'::json
        ) AS materials
      FROM items i
      LEFT JOIN proposal_item_generated_item_links link ON link.item_id = i.id
      LEFT JOIN LATERAL (
        SELECT DISTINCT ON (material_id) material_id, sort_order
        FROM (
          SELECT im.material_id, im.sort_order
          FROM item_materials im
          WHERE im.item_id = i.id
          UNION ALL
          SELECT pim.material_id, pim.sort_order
          FROM proposal_item_materials pim
          WHERE pim.proposal_item_id = link.proposal_item_id
        ) material_refs
        ORDER BY material_id, sort_order
      ) generated_materials ON true
      LEFT JOIN materials m ON m.id = generated_materials.material_id
      WHERE i.proposal_category_id = ${categoryId}
      GROUP BY i.id
    ),
    legacy_items AS (
      SELECT
        pi.id,
        pi.category_id,
        pi.product_tag,
        pi.plan,
        pi.drawings,
        pi.location,
        pi.description,
        pi.notes,
        pi.size_label,
        pi.size_mode,
        pi.size_w,
        pi.size_d,
        pi.size_h,
        pi.size_unit,
        pi.cbm,
        pi.quantity,
        pi.quantity_unit,
        pi.unit_cost_cents,
        pi.sort_order,
        pi.custom_data,
        pi.version,
        pi.created_at,
        pi.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', m.id,
              'project_id', m.project_id,
              'name', m.name,
              'material_id', m.material_id,
              'description', m.description,
              'swatch_hex', m.swatch_hex,
              'created_at', m.created_at,
              'updated_at', m.updated_at
            )
            ORDER BY pim.sort_order
          )
            FILTER (WHERE m.id IS NOT NULL),
          '[]'::json
        ) AS materials
      FROM proposal_items pi
      LEFT JOIN proposal_item_materials pim ON pim.proposal_item_id = pi.id
      LEFT JOIN materials m ON m.id = pim.material_id
      WHERE pi.category_id = ${categoryId}
        AND NOT EXISTS (
          SELECT 1
          FROM proposal_item_generated_item_links link
          WHERE link.proposal_item_id = pi.id
        )
      GROUP BY pi.id
    )
    SELECT *
    FROM canonical_items
    UNION ALL
    SELECT *
    FROM legacy_items
    ORDER BY sort_order, created_at
  `;
}

export async function selectCompatibleProposalItemsByCategory(sql: Sql, categoryId: string) {
  return sql`
    SELECT
      pi.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id',          m.id,
            'project_id',  m.project_id,
            'name',        m.name,
            'material_id', m.material_id,
            'description', m.description,
            'swatch_hex',  m.swatch_hex,
            'created_at',  m.created_at,
            'updated_at',  m.updated_at
          ) ORDER BY pim.sort_order
        ) FILTER (WHERE m.id IS NOT NULL),
        '[]'::json
      ) AS materials
    FROM  proposal_items pi
    LEFT  JOIN proposal_item_materials pim ON pim.proposal_item_id = pi.id
    LEFT  JOIN materials m                 ON m.id = pim.material_id
    WHERE pi.category_id = ${categoryId}
    GROUP BY pi.id
    ORDER BY pi.sort_order, pi.created_at
  `;
}
