import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/firebase-auth', () => ({
  verifyFirebaseToken: vi.fn(),
}));

vi.mock('../src/lib/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('../src/lib/ownership', () => ({
  getOwnedProjectContext: vi.fn(),
  getOwnedRoomContext: vi.fn(),
  getOwnedItemContext: vi.fn(),
  getOwnedMaterialContext: vi.fn(),
  getOwnedTakeoffItemContext: vi.fn(),
}));

import app from '../src/index';
import { getDb } from '../src/lib/db';
import { verifyFirebaseToken } from '../src/lib/firebase-auth';
import { getOwnedProjectContext, getOwnedTakeoffItemContext } from '../src/lib/ownership';

const mockVerify = vi.mocked(verifyFirebaseToken);
const mockGetDb = vi.mocked(getDb);
const mockGetOwnedProjectContext = vi.mocked(getOwnedProjectContext);
const mockGetOwnedTakeoffItemContext = vi.mocked(getOwnedTakeoffItemContext);

const bucketPut = vi.fn().mockResolvedValue(undefined);
const bucketDelete = vi.fn().mockResolvedValue(undefined);

const mockEnv = {
  FIREBASE_PROJECT_ID: 'test-project',
  FIREBASE_ADMIN_CLIENT_EMAIL: 'svc@test.iam.gserviceaccount.com',
  FIREBASE_ADMIN_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----\n',
  NEON_DATABASE_URL: 'postgresql://test:test@test.neon.tech/test',
  IMAGES_BUCKET: {
    put: bucketPut,
    delete: bucketDelete,
    get: vi.fn(),
    head: vi.fn(),
    list: vi.fn(),
    createMultipartUpload: vi.fn(),
    resumeMultipartUpload: vi.fn(),
  },
};

describe('Image uploads', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    bucketPut.mockResolvedValue(undefined);
    bucketDelete.mockResolvedValue(undefined);
    mockVerify.mockResolvedValue({ uid: 'user-123' });
    mockGetOwnedProjectContext.mockResolvedValue({
      projectId: '00000000-0000-0000-0000-000000000001',
    });
    mockGetOwnedTakeoffItemContext.mockResolvedValue({
      projectId: '00000000-0000-0000-0000-000000000001',
      takeoffItemId: '00000000-0000-0000-0000-000000000002',
    });
  });

  it('returns a client error when the database rejects a duplicate primary image insert', async () => {
    const sql = vi
      .fn()
      .mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));
    mockGetDb.mockReturnValue(sql as unknown as ReturnType<typeof getDb>);

    const body = new FormData();
    body.append('file', new File(['image-bytes'], 'rendering.png', { type: 'image/png' }));

    const res = await app.request(
      '/api/v1/images?entity_type=takeoff_item&entity_id=00000000-0000-0000-0000-000000000002&alt_text=MI-1+rendering',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body,
      },
      mockEnv,
    );

    expect(res.status).toBeLessThan(500);
    await expect(res.json()).resolves.toMatchObject({ error: expect.any(String) as string });
    expect(bucketDelete).toHaveBeenCalledTimes(1);
  });

  it('promotes another project image when the current preview image is deleted', async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: '00000000-0000-0000-0000-000000000011',
          owner_uid: 'user-123',
          project_id: '00000000-0000-0000-0000-000000000001',
          room_id: null,
          item_id: null,
          material_id: null,
          takeoff_item_id: null,
          r2_key: 'users/user-123/projects/project-1/project/1.png',
          filename: 'image-1.png',
          content_type: 'image/png',
          byte_size: 123,
          alt_text: 'Primary project image',
          is_primary: true,
          created_at: '2026-05-03T00:00:00Z',
          updated_at: '2026-05-03T00:00:00Z',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: '00000000-0000-0000-0000-000000000012',
          owner_uid: 'user-123',
          project_id: '00000000-0000-0000-0000-000000000001',
          room_id: null,
          item_id: null,
          material_id: null,
          takeoff_item_id: null,
          r2_key: 'users/user-123/projects/project-1/project/2.png',
          filename: 'image-2.png',
          content_type: 'image/png',
          byte_size: 123,
          alt_text: 'Secondary project image',
          is_primary: false,
          created_at: '2026-05-02T00:00:00Z',
          updated_at: '2026-05-02T00:00:00Z',
        },
      ])
      .mockResolvedValueOnce([]);
    mockGetDb.mockReturnValue(sql as unknown as ReturnType<typeof getDb>);

    const res = await app.request(
      '/api/v1/images/00000000-0000-0000-0000-000000000011',
      {
        method: 'DELETE',
        headers: { Authorization: 'Bearer valid-token' },
      },
      mockEnv,
    );

    expect(res.status).toBe(204);
    expect(bucketDelete).toHaveBeenCalledTimes(1);
    expect(sql).toHaveBeenCalledTimes(4);
    const statements = sql.mock.calls.map(([strings]) => Array.from(strings as string[]).join(' '));
    expect(statements[2]).toContain('SELECT *');
    expect(statements[3]).toContain('UPDATE image_assets');
  });
});
