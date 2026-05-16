import type { getDb } from './db';
import type { CreateItemInput, CreateProposalItemInput, UpdateItemInput } from '../types';
import { findOpenRevision, openRevision, type RevisionRow } from './revisions';

type Sql = ReturnType<typeof getDb>;
type DbRow = Record<string, unknown>;
type ProposalStatus = 'in_progress' | 'pricing_complete' | 'submitted' | 'approved';
type TrackedProposalStatus = Exclude<ProposalStatus, 'in_progress'>;

const trackedProposalStatuses = new Set<ProposalStatus>([
  'pricing_complete',
  'submitted',
  'approved',
]);

type FfeRevisionContext = {
  projectId: string;
  proposalStatus: ProposalStatus;
  proposalItemId: string | null;
  itemName: string;
  itemIdTag: string | null;
  dimensions: string | null;
  notes: string | null;
  qty: number;
  unitCostCents: number;
};

type FfeChange = {
  columnKey: string;
  previousValue: string;
  newValue: string;
  notes?: string;
  isPriceAffecting: boolean;
};

function plain(value: unknown) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value.toString();
  }
  return '';
}

function revisionChangesForFfePatch(input: UpdateItemInput, before: FfeRevisionContext) {
  const changes: FfeChange[] = [];

  if (input.item_name != null && input.item_name !== before.itemName) {
    changes.push({
      columnKey: 'description',
      previousValue: before.itemName,
      newValue: input.item_name,
      isPriceAffecting: false,
    });
  }
  if (input.item_id_tag != null && input.item_id_tag !== before.itemIdTag) {
    changes.push({
      columnKey: 'product_tag',
      previousValue: plain(before.itemIdTag),
      newValue: input.item_id_tag,
      isPriceAffecting: false,
    });
  }
  if (input.notes != null && input.notes !== before.notes) {
    changes.push({
      columnKey: 'notes',
      previousValue: plain(before.notes),
      newValue: input.notes,
      isPriceAffecting: false,
    });
  }
  if (input.dimensions != null && input.dimensions !== before.dimensions) {
    changes.push({
      columnKey: 'size_label',
      previousValue: plain(before.dimensions),
      newValue: input.dimensions,
      isPriceAffecting: true,
    });
  }
  if (input.qty != null && input.qty !== before.qty) {
    changes.push({
      columnKey: 'quantity',
      previousValue: String(before.qty),
      newValue: String(input.qty),
      isPriceAffecting: true,
    });
  }
  if (input.unit_cost_cents != null && input.unit_cost_cents !== before.unitCostCents) {
    changes.push({
      columnKey: 'unit_cost_cents',
      previousValue: String(before.unitCostCents),
      newValue: String(input.unit_cost_cents),
      isPriceAffecting: true,
    });
  }

  const confirmedChange = input.change_log;
  if (confirmedChange) {
    const matchingChange = changes.find(
      (change) => change.columnKey === confirmedChange.column_key,
    );
    if (matchingChange) {
      matchingChange.previousValue = confirmedChange.previous_value;
      matchingChange.newValue = confirmedChange.new_value;
      matchingChange.notes = confirmedChange.notes;
      matchingChange.isPriceAffecting =
        matchingChange.isPriceAffecting || confirmedChange.is_price_affecting;
    } else {
      changes.push({
        columnKey: confirmedChange.column_key,
        previousValue: confirmedChange.previous_value,
        newValue: confirmedChange.new_value,
        notes: confirmedChange.notes,
        isPriceAffecting: confirmedChange.is_price_affecting,
      });
    }
  }

  return changes;
}

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

async function selectFfeRevisionContext(sql: Sql, itemId: string) {
  const rows = await sql`
    SELECT
      r.project_id,
      p.proposal_status,
      link.proposal_item_id,
      i.item_name,
      i.item_id_tag,
      i.dimensions,
      i.notes,
      i.qty,
      i.unit_cost_cents
    FROM items i
    JOIN rooms r ON r.id = i.room_id
    JOIN projects p ON p.id = r.project_id
    LEFT JOIN proposal_item_generated_item_links link ON link.item_id = i.id
    WHERE i.id = ${itemId}
    LIMIT 1
  `;
  const row = rows[0] as
    | {
        project_id?: string;
        proposal_status?: ProposalStatus;
        proposal_item_id?: string | null;
        item_name?: string;
        item_id_tag?: string | null;
        dimensions?: string | null;
        notes?: string | null;
        qty?: number;
        unit_cost_cents?: number;
      }
    | undefined;
  if (!row?.project_id || !row.proposal_status || !row.item_name) return null;
  return {
    projectId: row.project_id,
    proposalStatus: row.proposal_status,
    proposalItemId: row.proposal_item_id ?? null,
    itemName: row.item_name,
    itemIdTag: row.item_id_tag ?? null,
    dimensions: row.dimensions ?? null,
    notes: row.notes ?? null,
    qty: row.qty ?? 0,
    unitCostCents: row.unit_cost_cents ?? 0,
  } satisfies FfeRevisionContext;
}

async function ensureProposalItemMirrorForGeneratedItem(sql: Sql, itemId: string) {
  const existing = await sql`
    SELECT proposal_item_id
    FROM proposal_item_generated_item_links
    WHERE item_id = ${itemId}
    LIMIT 1
  `;
  const existingRow = existing[0] as { proposal_item_id?: string } | undefined;
  if (existingRow?.proposal_item_id) return existingRow.proposal_item_id;

  const rows = await sql`
    INSERT INTO proposal_items (
      category_id, product_tag, plan, drawings, location, description, notes,
      size_label, size_mode, size_w, size_d, size_h, size_unit,
      cbm, quantity, quantity_unit, unit_cost_cents, sort_order, custom_data
    )
    SELECT
      i.proposal_category_id,
      COALESCE(NULLIF(i.product_tag, ''), i.item_id_tag, ''),
      i.plan,
      i.drawings,
      i.location,
      i.item_name,
      COALESCE(i.notes, ''),
      COALESCE(i.dimensions, i.size_label, ''),
      i.size_mode,
      i.size_w,
      i.size_d,
      i.size_h,
      i.size_unit,
      i.cbm,
      i.qty::numeric,
      'unit',
      i.unit_cost_cents,
      i.sort_order,
      i.custom_data
    FROM items i
    WHERE i.id = ${itemId}
      AND i.proposal_category_id IS NOT NULL
    RETURNING id
  `;
  const row = rows[0] as { id?: string } | undefined;
  if (!row?.id) return null;

  await sql`
    INSERT INTO proposal_item_generated_item_links (proposal_item_id, item_id)
    VALUES (${row.id}, ${itemId})
    ON CONFLICT (proposal_item_id) DO NOTHING
  `;
  return row.id;
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

export async function mirrorGeneratedItemToProposalItem(
  sql: Sql,
  itemId: string,
  options: { lockPriceFields?: boolean } = {},
) {
  await sql`
    UPDATE proposal_items pi
    SET
      category_id      = i.proposal_category_id,
      product_tag      = COALESCE(i.product_tag, ''),
      description      = i.item_name,
      notes            = COALESCE(i.notes, ''),
      size_label       = COALESCE(i.dimensions, ''),
      quantity         = CASE WHEN ${options.lockPriceFields === true}::boolean THEN pi.quantity ELSE i.qty::numeric END,
      quantity_unit    = 'unit',
      unit_cost_cents  = CASE WHEN ${options.lockPriceFields === true}::boolean THEN pi.unit_cost_cents ELSE i.unit_cost_cents END,
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

async function insertFfeRevisionChangelog(
  sql: Sql,
  itemId: string,
  proposalItemId: string,
  revision: RevisionRow | null,
  proposalStatus: ProposalStatus,
  changes: FfeChange[],
) {
  for (const change of changes) {
    await sql`
      INSERT INTO proposal_item_changelog
        (proposal_item_id, generated_item_id, column_key, previous_value, new_value,
         notes, proposal_status, revision_id, is_price_affecting)
      VALUES
        (${proposalItemId}, ${itemId}, ${change.columnKey}, ${change.previousValue},
         ${change.newValue}, ${change.notes ?? null}, ${proposalStatus}, ${revision?.id ?? null},
         ${change.isPriceAffecting})
    `;
  }
}

async function updateFfeRevisionSnapshot(
  sql: Sql,
  proposalItemId: string,
  revision: RevisionRow,
  input: UpdateItemInput,
  changes: FfeChange[],
) {
  const hasQuantityChange = changes.some((change) => change.columnKey === 'quantity');
  const hasUnitCostChange = changes.some((change) => change.columnKey === 'unit_cost_cents');
  const hasSizeChange = changes.some((change) => change.columnKey === 'size_label');

  if (hasQuantityChange && input.qty != null) {
    await sql`
      UPDATE proposal_revision_snapshots
      SET    quantity = ${input.qty}, cost_status = 'flagged'
      WHERE  revision_id = ${revision.id} AND item_id = ${proposalItemId}
    `;
  }

  if (hasUnitCostChange && input.unit_cost_cents != null) {
    await sql`
      UPDATE proposal_revision_snapshots
      SET    unit_cost_cents = ${input.unit_cost_cents}, cost_status = 'flagged'
      WHERE  revision_id = ${revision.id} AND item_id = ${proposalItemId}
    `;
  } else if (hasSizeChange) {
    await sql`
      UPDATE proposal_revision_snapshots
      SET    unit_cost_cents = NULL, cost_status = 'flagged'
      WHERE  revision_id = ${revision.id} AND item_id = ${proposalItemId}
    `;
  }
}

async function applyFfeRevisionEffects(
  sql: Sql,
  itemId: string,
  input: UpdateItemInput,
  before: FfeRevisionContext | null,
) {
  if (!before) return { lockPriceFields: false };

  const changes = revisionChangesForFfePatch(input, before);
  if (changes.length === 0) return { lockPriceFields: false };

  let proposalItemId = before.proposalItemId;
  if (!proposalItemId) {
    proposalItemId = await ensureProposalItemMirrorForGeneratedItem(sql, itemId);
  }
  if (!proposalItemId) return { lockPriceFields: false };

  let revision = await findOpenRevision(sql, before.projectId);
  const shouldOpenRevision = !revision && trackedProposalStatuses.has(before.proposalStatus);

  if (shouldOpenRevision) {
    revision = await openRevision(
      sql,
      before.projectId,
      before.proposalStatus as TrackedProposalStatus,
    );
  }

  if (revision || trackedProposalStatuses.has(before.proposalStatus)) {
    await insertFfeRevisionChangelog(
      sql,
      itemId,
      proposalItemId,
      revision,
      before.proposalStatus,
      changes,
    );
  }

  if (revision) {
    await updateFfeRevisionSnapshot(sql, proposalItemId, revision, input, changes);
  }

  return { lockPriceFields: revision != null };
}

export async function updateGeneratedItemFromFfe(sql: Sql, itemId: string, input: UpdateItemInput) {
  const before = await selectFfeRevisionContext(sql, itemId);
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
  if (rows[0]) {
    const revisionEffects = await applyFfeRevisionEffects(sql, itemId, input, before);
    await mirrorGeneratedItemToProposalItem(sql, itemId, {
      lockPriceFields: revisionEffects.lockPriceFields,
    });
  }
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
