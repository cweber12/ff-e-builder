import { describe, expect, it, vi } from 'vitest';

import {
  selectGeneratedItemsByProposalCategory,
  selectGeneratedItemsByRoom,
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
});
