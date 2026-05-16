import type { getDb } from './db';

type Sql = ReturnType<typeof getDb>;

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
