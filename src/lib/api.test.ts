import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist a mutable auth stub so it's available inside the vi.mock factory
const mockAuth = vi.hoisted(() => ({
  currentUser: null as null | { getIdToken: (force: boolean) => Promise<string> },
}));

vi.mock('./auth', () => ({
  auth: mockAuth,
  getCurrentIdToken: () => mockAuth.currentUser?.getIdToken(false),
}));

// Import AFTER mocks are set up
import { api, ApiError } from './api';

// ─── Helpers ──────────────────────────────────────────────────────────────

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  mockAuth.currentUser = null;
});

describe('api client - images', () => {
  it('lists image metadata for an entity', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        images: [
          {
            id: 'img-1',
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

    const images = await api.images.list({ entityType: 'project', entityId: 'project-1' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/images?entity_type=project&entity_id=project-1'),
      expect.any(Object),
    );
    expect(images[0]).toMatchObject({
      id: 'img-1',
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
    await api.images.upload({ entityType: 'project', entityId: 'project-1', file });

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(FormData);
    expect(init?.headers).toBeInstanceOf(Headers);
    expect((init?.headers as Headers).get('Content-Type')).toBeNull();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Tests ────────────────────────────────────────────────────────────────

describe('api client — auth header', () => {
  it('attaches Authorization header when the user is signed in', async () => {
    const token = 'firebase-id-token-abc';
    mockAuth.currentUser = {
      getIdToken: vi.fn<(force: boolean) => Promise<string>>().mockResolvedValue(token),
    };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ projects: [] }));

    await api.projects.list();

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(init?.headers).toBeInstanceOf(Headers);
    expect((init?.headers as Headers).get('Authorization')).toBe(`Bearer ${token}`);
  });

  it('omits Authorization header when signed out', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ projects: [] }));

    await api.projects.list();

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(init?.headers).toBeInstanceOf(Headers);
    expect((init?.headers as Headers).get('Authorization')).toBeNull();
  });
});

describe('api client — error handling', () => {
  it('throws ApiError with status 404 on Not Found', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'Not found' }, 404));

    const err = await api.projects.list().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(404);
    expect((err as ApiError).message).toBe('Not found');
  });

  it('throws ApiError with status 500 on server error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Internal Server Error', { status: 500 }));

    const err = await api.projects.list().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(500);
  });

  it('throws ApiError with status 409 on conflict', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'Version conflict' }, 409));

    const err = await api.items.update('item-1', { version: 1 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(409);
  });
});
