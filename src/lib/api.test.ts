import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist a mutable auth stub so it's available inside the vi.mock factory
const mockAuth = vi.hoisted(() => ({
  currentUser: null as null | { getIdToken: (force: boolean) => Promise<string> },
}));

vi.mock('./auth', () => ({ auth: mockAuth }));

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

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        headers: expect.objectContaining({ Authorization: `Bearer ${token}` }),
      }),
    );
  });

  it('omits Authorization header when signed out', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ projects: [] }));

    await api.projects.list();

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        headers: expect.objectContaining({ Authorization: expect.any(String) }),
      }),
    );
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
