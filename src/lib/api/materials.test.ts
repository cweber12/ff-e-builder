import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, setupApiTest } from './test-utils';
import { materialsApi } from './materials';

setupApiTest();

describe('materialsApi', () => {
  it('creates project materials with default swatch metadata', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        {
          material: {
            id: 'material-1',
            project_id: 'project-1',
            name: 'Walnut',
            material_id: 'WD-01',
            description: 'Natural walnut',
            swatch_hex: '#D9D4C8',
            created_at: '2026-05-01T00:00:00Z',
            updated_at: '2026-05-02T00:00:00Z',
          },
        },
        201,
      ),
    );

    const material = await materialsApi.create('project-1', {
      name: 'Walnut',
      materialId: 'WD-01',
      description: 'Natural walnut',
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/projects/project-1/materials'),
      expect.objectContaining({ method: 'POST' }),
    );
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(typeof init?.body).toBe('string');
    expect(JSON.parse(init?.body as string)).toEqual({
      name: 'Walnut',
      material_id: 'WD-01',
      description: 'Natural walnut',
      swatch_hex: '#D9D4C8',
    });
    expect(material).toMatchObject({
      id: 'material-1',
      projectId: 'project-1',
      materialId: 'WD-01',
      swatchHex: '#D9D4C8',
    });
  });

  it('updates proposal item material assignments without swatch metadata', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        material: {
          id: 'material-1',
          project_id: 'project-1',
          name: 'Oak',
          material_id: 'WD-02',
          description: 'White oak',
          swatch_hex: '#C8B99A',
          created_at: '2026-05-01T00:00:00Z',
          updated_at: '2026-05-02T00:00:00Z',
        },
      }),
    );

    await materialsApi.updateForProposalItem('proposal-item-1', 'material-1', {
      name: 'Oak',
      materialId: 'WD-02',
      description: 'White oak',
      swatchHex: '#FFFFFF',
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/proposal/items/proposal-item-1/materials/material-1'),
      expect.objectContaining({ method: 'PATCH' }),
    );
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(typeof init?.body).toBe('string');
    expect(JSON.parse(init?.body as string)).toEqual({
      name: 'Oak',
      material_id: 'WD-02',
      description: 'White oak',
    });
  });
});
