import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, setupApiTest } from './test-utils';
import { itemsApi } from './items';

setupApiTest();

describe('itemsApi', () => {
  it('updates items with worker field names and the current version', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        item: {
          id: 'item-1',
          room_id: 'room-2',
          item_name: 'Lounge Chair',
          description: 'Curved upholstered lounge chair',
          category: 'Seating',
          item_id_tag: null,
          dimensions: null,
          seat_height: null,
          notes: null,
          qty: 2,
          unit_cost_cents: 125000,
          lead_time: null,
          status: 'approved',
          image_url: null,
          link_url: null,
          sort_order: 4,
          version: 8,
          created_at: '2026-05-01T00:00:00Z',
          updated_at: '2026-05-02T00:00:00Z',
        },
      }),
    );

    const item = await itemsApi.update('item-1', {
      roomId: 'room-2',
      itemName: 'Lounge Chair',
      description: 'Curved upholstered lounge chair',
      qty: 2,
      unitCostCents: 125000,
      status: 'approved',
      sortOrder: 4,
      version: 7,
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/items/item-1'),
      expect.objectContaining({ method: 'PATCH' }),
    );
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(typeof init?.body).toBe('string');
    expect(JSON.parse(init?.body as string)).toMatchObject({
      item_name: 'Lounge Chair',
      room_id: 'room-2',
      description: 'Curved upholstered lounge chair',
      qty: 2,
      unit_cost_cents: 125000,
      status: 'approved',
      sort_order: 4,
      version: 7,
    });
    expect(item).toMatchObject({
      id: 'item-1',
      roomId: 'room-2',
      itemName: 'Lounge Chair',
      description: 'Curved upholstered lounge chair',
      version: 8,
    });
  });
});
