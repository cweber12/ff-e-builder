import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockAuth, setupApiTest } from './api/test-utils';
import { api, ApiError } from './api';

setupApiTest();

describe('api client - auth header', () => {
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

describe('api client - error handling', () => {
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
