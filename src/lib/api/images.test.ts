import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, setupApiTest } from './test-utils';
import { imagesApi } from './images';

setupApiTest();

describe('imagesApi', () => {
  it('lists image metadata for an entity', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        images: [
          {
            id: 'img-1',
            entity_type: 'project',
            owner_uid: 'uid-1',
            project_id: 'project-1',
            room_id: null,
            item_id: null,
            filename: 'hero.jpg',
            content_type: 'image/jpeg',
            byte_size: 1024,
            alt_text: 'Project hero',
            is_primary: true,
            created_at: '2026-05-01T00:00:00Z',
            updated_at: '2026-05-01T00:00:00Z',
          },
        ],
      }),
    );

    const images = await imagesApi.list({ entityType: 'project', entityId: 'project-1' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/images?entity_type=project&entity_id=project-1'),
      expect.any(Object),
    );
    expect(images[0]).toMatchObject({
      id: 'img-1',
      entityType: 'project',
      projectId: 'project-1',
      contentType: 'image/jpeg',
      isPrimary: true,
    });
  });

  it('uploads image files as form data without a JSON content type', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        {
          image: {
            id: 'img-1',
            entity_type: 'project',
            owner_uid: 'uid-1',
            project_id: 'project-1',
            room_id: null,
            item_id: null,
            filename: 'hero.jpg',
            content_type: 'image/jpeg',
            byte_size: 1024,
            alt_text: '',
            is_primary: true,
            created_at: '2026-05-01T00:00:00Z',
            updated_at: '2026-05-01T00:00:00Z',
          },
        },
        201,
      ),
    );

    const file = new File(['image-bytes'], 'hero.jpg', { type: 'image/jpeg' });
    await imagesApi.upload({ entityType: 'project', entityId: 'project-1', file });

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(FormData);
    expect(init?.headers).toBeInstanceOf(Headers);
    expect((init?.headers as Headers).get('Content-Type')).toBeNull();
  });

  it('downloads image content as a blob', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('image-bytes', { headers: { 'Content-Type': 'image/jpeg' } }),
    );

    const result = await imagesApi.getContentBlob('img-1');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/images/img-1/content'),
      expect.any(Object),
    );
    expect(result.type).toBe('image/jpeg');
    expect(await result.text()).toBe('image-bytes');
  });

  it('sets crop metadata with worker field names', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        image: {
          id: 'img-1',
          entity_type: 'project',
          owner_uid: 'uid-1',
          project_id: 'project-1',
          room_id: null,
          item_id: null,
          material_id: null,
          proposal_item_id: null,
          filename: 'hero.jpg',
          content_type: 'image/jpeg',
          byte_size: 1024,
          alt_text: '',
          is_primary: true,
          crop_x: 1,
          crop_y: 2,
          crop_width: 300,
          crop_height: 200,
          created_at: '2026-05-01T00:00:00Z',
          updated_at: '2026-05-02T00:00:00Z',
        },
      }),
    );

    const image = await imagesApi.setCrop('img-1', {
      cropX: 1,
      cropY: 2,
      cropWidth: 300,
      cropHeight: 200,
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/images/img-1/crop'),
      expect.objectContaining({ method: 'PATCH' }),
    );
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(typeof init?.body).toBe('string');
    expect(JSON.parse(init?.body as string)).toEqual({
      crop_x: 1,
      crop_y: 2,
      crop_width: 300,
      crop_height: 200,
    });
    expect(image).toMatchObject({
      id: 'img-1',
      cropX: 1,
      cropY: 2,
      cropWidth: 300,
      cropHeight: 200,
    });
  });
});
