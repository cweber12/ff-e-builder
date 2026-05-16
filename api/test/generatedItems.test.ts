import { describe, expect, it, vi } from 'vitest';

import {
  createGeneratedItemFromFfe,
  createGeneratedItemFromProposal,
  selectCompatibleProposalItemsByCategory,
  selectGeneratedItemsByProposalCategory,
  selectGeneratedItemsByRoom,
  updateGeneratedItemFromFfe,
} from '../src/lib/generatedItems';
import type { getDb } from '../src/lib/db';

const generatedItemRow = {
  id: 'item-1',
  room_id: 'room-1',
  proposal_category_id: 'category-1',
  item_name: 'Lounge chair',
  product_tag: 'F-101',
};

describe('Generated Item read model', () => {
  it('can read the same canonical item through room and proposal category groupings', async () => {
    const sql = vi.fn().mockResolvedValue([generatedItemRow]);

    const roomRows = await selectGeneratedItemsByRoom(
      sql as unknown as ReturnType<typeof getDb>,
      'room-1',
    );
    const proposalRows = await selectGeneratedItemsByProposalCategory(
      sql as unknown as ReturnType<typeof getDb>,
      'category-1',
    );

    expect(roomRows[0]?.id).toBe('item-1');
    expect(proposalRows[0]?.id).toBe('item-1');

    const statements = (sql.mock.calls as Array<[TemplateStringsArray, ...unknown[]]>).map(
      ([strings]) => Array.from(strings).join(' '),
    );
    expect(statements[0]).toContain('WHERE i.room_id =');
    expect(statements[1]).toContain('WHERE i.proposal_category_id =');
    expect(statements[1]).toContain('proposal_item_generated_item_links');
    expect(statements[1]).toContain('UNION ALL');
  });

  it('keeps a compatibility reader for current Proposal item endpoints', async () => {
    const sql = vi.fn().mockResolvedValue([]);

    await selectCompatibleProposalItemsByCategory(
      sql as unknown as ReturnType<typeof getDb>,
      'category-1',
    );

    const statement = Array.from(
      (sql.mock.calls[0] as [TemplateStringsArray, ...unknown[]])[0],
    ).join(' ');
    expect(statement).toContain('FROM proposal_items pi');
    expect(statement).toContain('WHERE pi.category_id =');
    expect(statement).not.toContain('canonical_items');
  });

  it('creates an FF&E item with a linked Furniture proposal item mirror', async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ project_id: 'project-1' }])
      .mockResolvedValueOnce([{ id: 'furniture-category-1' }])
      .mockResolvedValueOnce([{ id: 'item-1' }])
      .mockResolvedValueOnce([{ id: 'proposal-item-1' }])
      .mockResolvedValueOnce([]);

    const item = await createGeneratedItemFromFfe(
      sql as unknown as ReturnType<typeof getDb>,
      'room-1',
      {
        item_name: 'Lounge chair',
        description: null,
        category: null,
        item_id_tag: 'F-101',
        dimensions: null,
        notes: null,
        qty: 2,
        unit_cost_cents: 120000,
        lead_time: null,
        status: 'pending',
        custom_data: {},
        sort_order: 0,
      },
    );

    expect(item.id).toBe('item-1');
    const statements = (sql.mock.calls as Array<[TemplateStringsArray, ...unknown[]]>).map(
      ([strings]) => Array.from(strings).join(' '),
    );
    expect(statements[1]).toContain("lower(name) = 'furniture'");
    expect(statements[2]).toContain('INSERT INTO items');
    expect(statements[2]).toContain('proposal_category_id, product_tag, quantity, quantity_unit');
    expect(statements[3]).toContain('INSERT INTO proposal_items');
    expect(statements[4]).toContain('proposal_item_generated_item_links');
  });

  it('creates a Proposal item with a linked Unassigned generated item mirror', async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ project_id: 'project-1' }])
      .mockResolvedValueOnce([{ id: 'unassigned-room-1' }])
      .mockResolvedValueOnce([{ id: 'proposal-item-1' }])
      .mockResolvedValueOnce([{ id: 'item-1' }])
      .mockResolvedValueOnce([]);

    const item = await createGeneratedItemFromProposal(
      sql as unknown as ReturnType<typeof getDb>,
      'category-1',
      {
        product_tag: 'F-101',
        plan: '',
        drawings: '',
        location: '',
        description: 'Lounge chair',
        notes: '',
        size_label: '',
        size_mode: 'imperial',
        size_w: '',
        size_d: '',
        size_h: '',
        size_unit: 'in',
        cbm: 0,
        quantity: 2,
        quantity_unit: 'unit',
        unit_cost_cents: 120000,
        sort_order: 0,
        custom_data: {},
      },
    );

    expect(item.id).toBe('proposal-item-1');
    const statements = (sql.mock.calls as Array<[TemplateStringsArray, ...unknown[]]>).map(
      ([strings]) => Array.from(strings).join(' '),
    );
    expect(statements[1]).toContain("lower(name) = 'unassigned'");
    expect(statements[2]).toContain('INSERT INTO proposal_items');
    expect(statements[3]).toContain('INSERT INTO items');
    expect(statements[4]).toContain('proposal_item_generated_item_links');
  });

  it('mirrors FF&E updates into a linked Proposal item', async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([
        {
          project_id: 'project-1',
          proposal_status: 'in_progress',
          proposal_item_id: 'proposal-item-1',
          item_name: 'Lounge chair',
          item_id_tag: 'F-101',
          dimensions: '',
          notes: '',
          qty: 2,
          unit_cost_cents: 120000,
        },
      ])
      .mockResolvedValueOnce([{ id: 'item-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const item = await updateGeneratedItemFromFfe(
      sql as unknown as ReturnType<typeof getDb>,
      'item-1',
      {
        item_name: 'Updated chair',
        item_id_tag: 'F-102',
        qty: 3,
        version: 1,
      },
    );

    expect(item?.id).toBe('item-1');
    const statements = (sql.mock.calls as Array<[TemplateStringsArray, ...unknown[]]>).map(
      ([strings]) => Array.from(strings).join(' '),
    );
    expect(statements[1]).toContain('UPDATE items');
    expect(statements[1]).toContain('product_tag');
    expect(statements[1]).toContain('quantity');
    expect(statements[3]).toContain('UPDATE proposal_items pi');
    expect(statements[3]).toContain('proposal_item_generated_item_links');
  });

  it('opens a revision and flags snapshot cost review for FF&E quantity edits after pricing', async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([
        {
          project_id: 'project-1',
          proposal_status: 'pricing_complete',
          proposal_item_id: 'proposal-item-1',
          item_name: 'Lounge chair',
          item_id_tag: 'F-101',
          dimensions: '',
          notes: '',
          qty: 2,
          unit_cost_cents: 120000,
        },
      ])
      .mockResolvedValueOnce([{ id: 'item-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ last_revision_major: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'revision-1',
          project_id: 'project-1',
          revision_major: 1,
          revision_minor: 1,
          triggered_at_status: 'pricing_complete',
          opened_at: '2026-05-16T00:00:00.000Z',
          closed_at: null,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await updateGeneratedItemFromFfe(sql as unknown as ReturnType<typeof getDb>, 'item-1', {
      qty: 3,
      version: 1,
    });

    const statements = (sql.mock.calls as Array<[TemplateStringsArray, ...unknown[]]>).map(
      ([strings]) => Array.from(strings).join(' '),
    );
    expect(
      statements.some((statement) => statement.includes('INSERT INTO proposal_revisions')),
    ).toBe(true);
    expect(
      statements.some((statement) => statement.includes('INSERT INTO proposal_item_changelog')),
    ).toBe(true);
    expect(
      statements.some((statement) => statement.includes('UPDATE proposal_revision_snapshots')),
    ).toBe(true);
    expect(statements.at(-1)).toContain('UPDATE proposal_items pi');
  });
});
