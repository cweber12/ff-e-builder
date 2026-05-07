import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, setupApiTest } from './test-utils';
import { plansApi } from './plans';

setupApiTest();

describe('plansApi', () => {
  it('lists measured plans for a project', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        plans: [
          {
            id: 'plan-1',
            project_id: 'project-1',
            owner_uid: 'user-1',
            name: 'Level 1 Furniture Plan',
            sheet_reference: 'A1.1',
            image_filename: 'level-1.png',
            image_content_type: 'image/png',
            image_byte_size: 12345,
            calibration_status: 'uncalibrated',
            measurement_count: 0,
            created_at: '2026-05-06T00:00:00Z',
            updated_at: '2026-05-06T00:00:00Z',
          },
        ],
      }),
    );

    await expect(plansApi.list('project-1')).resolves.toEqual([
      expect.objectContaining({
        id: 'plan-1',
        projectId: 'project-1',
        ownerUid: 'user-1',
        name: 'Level 1 Furniture Plan',
        sheetReference: 'A1.1',
        calibrationStatus: 'uncalibrated',
        measurementCount: 0,
      }),
    ]);
  });

  it('uploads a measured plan with multipart form data', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        plan: {
          id: 'plan-1',
          project_id: 'project-1',
          owner_uid: 'user-1',
          name: 'Level 1 Furniture Plan',
          sheet_reference: 'A1.1',
          image_filename: 'level-1.png',
          image_content_type: 'image/png',
          image_byte_size: 12345,
          calibration_status: 'uncalibrated',
          measurement_count: 0,
          created_at: '2026-05-06T00:00:00Z',
          updated_at: '2026-05-06T00:00:00Z',
        },
      }),
    );

    const file = new File(['plan'], 'level-1.png', { type: 'image/png' });
    await plansApi.create('project-1', {
      name: 'Level 1 Furniture Plan',
      sheetReference: 'A1.1',
      file,
    });

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(FormData);

    const formData = init?.body as FormData;
    expect(formData.get('name')).toBe('Level 1 Furniture Plan');
    expect(formData.get('sheet_reference')).toBe('A1.1');
    expect(formData.get('file')).toBe(file);
  });

  it('deletes a measured plan', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await plansApi.delete('project-1', 'plan-1');

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/projects/project-1/plans/plan-1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('downloads measured plan content as a blob', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('content', { status: 200, headers: { 'Content-Type': 'image/png' } }),
    );

    const blob = await plansApi.downloadContent('project-1', 'plan-1');

    expect(blob.type).toBe('image/png');
    await expect(blob.text()).resolves.toBe('content');
  });
});
