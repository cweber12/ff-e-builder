import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, setupApiTest } from './test-utils';
import { roomsApi } from './rooms';

setupApiTest();

describe('roomsApi', () => {
  it('creates rooms under a project with worker field names', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        {
          room: {
            id: 'room-1',
            project_id: 'project-1',
            name: 'Living Room',
            sort_order: 2,
            created_at: '2026-05-01T00:00:00Z',
            updated_at: '2026-05-02T00:00:00Z',
          },
        },
        201,
      ),
    );

    const room = await roomsApi.create('project-1', {
      name: 'Living Room',
      sortOrder: 2,
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/projects/project-1/rooms'),
      expect.objectContaining({ method: 'POST' }),
    );
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(typeof init?.body).toBe('string');
    expect(JSON.parse(init?.body as string)).toEqual({
      name: 'Living Room',
      sort_order: 2,
    });
    expect(room).toMatchObject({
      id: 'room-1',
      projectId: 'project-1',
      sortOrder: 2,
    });
  });
});
