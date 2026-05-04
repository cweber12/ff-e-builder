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

const projectId = '00000000-0000-0000-0000-000000000001';
const takeoffItemId = '00000000-0000-0000-0000-000000000002';
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

function multipartImageBody(filename = 'rendering.png') {
  const body = new FormData();
  body.append('file', new File(['image-bytes'], filename, { type: 'image/png' }));
  return body;
}

describe('Image uploads', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    bucketPut.mockResolvedValue(undefined);
    bucketDelete.mockResolvedValue(undefined);
    mockVerify.mockResolvedValue({ uid: 'user-123' });
    mockGetOwnedProjectContext.mockResolvedValue({ projectId });
    mockGetOwnedTakeoffItemContext.mockResolvedValue({
      projectId,
      takeoffItemId,
    });
  });

  it('returns a client error when the database rejects a duplicate primary image insert', async () => {
    const sql = vi
      .fn()
      .mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));
    mockGetDb.mockReturnValue(sql as unknown as ReturnType<typeof getDb>);

    const res = await app.request(
      `/api/v1/images?entity_type=takeoff_item&entity_id=${takeoffItemId}&alt_text=MI-1+rendering`,
      {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: multipartImageBody(),
      },
      mockEnv,
    );

    expect(res.status).toBeLessThan(500);
    await expect(res.json()).resolves.toMatchObject({ error: expect.any(String) as string });
    expect(bucketDelete).toHaveBeenCalledTimes(1);
  });

  it('allows a second project image without making it the preview image', async () => {
    const sql = vi.fn(
      async (strings: TemplateStringsArray, ...values: unknown[]) =>
        await Promise.resolve().then(() => {
          const query = strings.join('?');

          if (query.includes('COUNT(*)::int AS count')) return [{ count: 1 }];
          if (query.includes('INSERT INTO image_assets')) {
            const isPrimary = values.at(-1);
            if (isPrimary !== false) {
              throw new Error(
                'duplicate key value violates unique constraint "image_assets_primary_project_idx"',
              );
            }
            return [
              {
                id: '00000000-0000-0000-0000-000000000010',
                entity_type: 'project',
                owner_uid: 'user-123',
                project_id: projectId,
                room_id: null,
                item_id: null,
                material_id: null,
                takeoff_item_id: null,
                r2_key: 'users/user-123/projects/project/project-2.png',
                filename: 'project-2.png',
                content_type: 'image/png',
                byte_size: 11,
                alt_text: 'Sample Project image 2',
                is_primary: false,
                created_at: '2026-05-03T00:00:00Z',
                updated_at: '2026-05-03T00:00:00Z',
              },
            ];
          }

          return [];
        }),
    );
    mockGetDb.mockReturnValue(sql as unknown as ReturnType<typeof getDb>);

    const res = await app.request(
      `/api/v1/images?entity_type=project&entity_id=${projectId}&alt_text=Sample+Project+image+2`,
      {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: multipartImageBody('project-2.png'),
      },
      mockEnv,
    );

    expect(res.status).toBe(201);
    expect(sql).toHaveBeenCalledTimes(2);
    const statements = sql.mock.calls.map(([strings]) => Array.from(strings).join(' '));
    expect(statements[1]).toContain('INSERT INTO image_assets');
    expect(statements[1]).not.toContain('UPDATE image_assets');
    await expect(res.json()).resolves.toMatchObject({
      image: {
        project_id: projectId,
        is_primary: false,
      },
    });
  });

  it('allows up to four take-off swatches without promoting them to rendering images', async () => {
    const sql = vi.fn(
      async (strings: TemplateStringsArray, ...values: unknown[]) =>
        await Promise.resolve().then(() => {
          const query = strings.join('?');

          if (query.includes('COUNT(*)::int AS count')) return [{ count: 3 }];
          if (query.includes('INSERT INTO image_assets')) {
            const isPrimary = values.at(-1);
            return [
              {
                id: '00000000-0000-0000-0000-000000000013',
                entity_type: 'takeoff_swatch',
                owner_uid: 'user-123',
                project_id: projectId,
                room_id: null,
                item_id: null,
                material_id: null,
                takeoff_item_id: takeoffItemId,
                r2_key: 'users/user-123/projects/project-1/takeoff/items/item-1/swatches/3.png',
                filename: 'swatch-4.png',
                content_type: 'image/png',
                byte_size: 11,
                alt_text: 'Take-Off swatch 4',
                is_primary: isPrimary,
                created_at: '2026-05-03T00:00:00Z',
                updated_at: '2026-05-03T00:00:00Z',
              },
            ];
          }

          return [];
        }),
    );
    mockGetDb.mockReturnValue(sql as unknown as ReturnType<typeof getDb>);

    const res = await app.request(
      `/api/v1/images?entity_type=takeoff_swatch&entity_id=${takeoffItemId}&alt_text=Take-Off+swatch+4`,
      {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: multipartImageBody('swatch-4.png'),
      },
      mockEnv,
    );

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({
      image: {
        takeoff_item_id: takeoffItemId,
        is_primary: false,
      },
    });
  });

  it('allows a take-off plan image without colliding with the rendering image role', async () => {
    const sql = vi.fn(
      async (strings: TemplateStringsArray) =>
        await Promise.resolve().then(() => {
          const query = strings.join('?');

          if (query.includes('INSERT INTO image_assets')) {
            return [
              {
                id: '00000000-0000-0000-0000-000000000014',
                entity_type: 'takeoff_plan',
                owner_uid: 'user-123',
                project_id: projectId,
                room_id: null,
                item_id: null,
                material_id: null,
                takeoff_item_id: takeoffItemId,
                r2_key: 'users/user-123/projects/project-1/takeoff/items/item-1/plan/1.png',
                filename: 'plan.png',
                content_type: 'image/png',
                byte_size: 11,
                alt_text: 'Take-Off plan',
                is_primary: true,
                created_at: '2026-05-03T00:00:00Z',
                updated_at: '2026-05-03T00:00:00Z',
              },
            ];
          }

          return [];
        }),
    );
    mockGetDb.mockReturnValue(sql as unknown as ReturnType<typeof getDb>);

    const res = await app.request(
      `/api/v1/images?entity_type=takeoff_plan&entity_id=${takeoffItemId}&alt_text=Take-Off+plan`,
      {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: multipartImageBody('plan.png'),
      },
      mockEnv,
    );

    expect(res.status).toBe(201);
    const statement = Array.from(sql.mock.calls[0]?.[0] ?? []).join(' ');
    expect(statement).toContain('entity_type =');
    await expect(res.json()).resolves.toMatchObject({
      image: {
        entity_type: 'takeoff_plan',
        takeoff_item_id: takeoffItemId,
        is_primary: true,
      },
    });
  });

  it('rejects a fifth take-off swatch with a client error', async () => {
    const sql = vi.fn().mockResolvedValueOnce([{ count: 4 }]);
    mockGetDb.mockReturnValue(sql as unknown as ReturnType<typeof getDb>);

    const res = await app.request(
      `/api/v1/images?entity_type=takeoff_swatch&entity_id=${takeoffItemId}&alt_text=Take-Off+swatch+5`,
      {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: multipartImageBody('swatch-5.png'),
      },
      mockEnv,
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: 'Take-Off items can have up to 4 swatches',
    });
    expect(bucketDelete).toHaveBeenCalledTimes(1);
  });

  it('promotes another project image when the current preview image is deleted', async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: '00000000-0000-0000-0000-000000000011',
          entity_type: 'project',
          owner_uid: 'user-123',
          project_id: projectId,
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
          entity_type: 'project',
          owner_uid: 'user-123',
          project_id: projectId,
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
    const statements = (sql.mock.calls as Array<[TemplateStringsArray, ...unknown[]]>).map(
      ([strings]) => Array.from(strings).join(' '),
    );
    expect(statements[2]).toContain('SELECT *');
    expect(statements[3]).toContain('UPDATE image_assets');
  });
});
