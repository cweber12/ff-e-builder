import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, setupApiTest } from './test-utils';
import { proposalApi } from './proposal';

setupApiTest();

describe('proposalApi', () => {
  it('creates proposal categories under a project with worker field names', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        {
          category: {
            id: 'category-1',
            project_id: 'project-1',
            name: 'Millwork',
            sort_order: 3,
            created_at: '2026-05-01T00:00:00Z',
            updated_at: '2026-05-02T00:00:00Z',
          },
        },
        201,
      ),
    );

    const category = await proposalApi.createCategory('project-1', {
      name: 'Millwork',
      sortOrder: 3,
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/projects/project-1/proposal/categories'),
      expect.objectContaining({ method: 'POST' }),
    );
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(typeof init?.body).toBe('string');
    expect(JSON.parse(init?.body as string)).toEqual({
      name: 'Millwork',
      sort_order: 3,
    });
    expect(category).toMatchObject({
      id: 'category-1',
      projectId: 'project-1',
      sortOrder: 3,
    });
  });

  it('updates proposal items with worker field names and the current version', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        item: {
          id: 'proposal-item-1',
          category_id: 'category-2',
          product_tag: 'M-101',
          plan: 'A1.01',
          drawings: 'D1',
          location: 'Lobby',
          description: 'Reception desk',
          size_label: 'Custom',
          size_mode: 'imperial',
          size_w: '72',
          size_d: '30',
          size_h: '36',
          size_unit: 'in',
          cbm: '1.5',
          quantity: '2',
          quantity_unit: 'unit',
          unit_cost_cents: 420000,
          sort_order: 5,
          version: 9,
          created_at: '2026-05-01T00:00:00Z',
          updated_at: '2026-05-02T00:00:00Z',
        },
      }),
    );

    const item = await proposalApi.updateItem('proposal-item-1', {
      categoryId: 'category-2',
      productTag: 'M-101',
      plan: 'A1.01',
      location: 'Lobby',
      quantity: 2,
      unitCostCents: 420000,
      sortOrder: 5,
      version: 8,
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/proposal/items/proposal-item-1'),
      expect.objectContaining({ method: 'PATCH' }),
    );
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(typeof init?.body).toBe('string');
    expect(JSON.parse(init?.body as string)).toMatchObject({
      category_id: 'category-2',
      product_tag: 'M-101',
      plan: 'A1.01',
      location: 'Lobby',
      quantity: 2,
      unit_cost_cents: 420000,
      sort_order: 5,
      version: 8,
    });
    expect(item).toMatchObject({
      id: 'proposal-item-1',
      categoryId: 'category-2',
      productTag: 'M-101',
      quantity: 2,
      version: 9,
    });
  });

  it('adds a proposal item to FF&E with an explicit worker action', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ item: { id: 'generated-item-1' } }));

    await proposalApi.addItemToFfe('proposal-item-1');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/proposal/items/proposal-item-1/add-to-ffe'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
