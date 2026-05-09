import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock calls are hoisted above imports by Vitest — order here is intentional.
vi.mock('../src/lib/firebase-auth', () => ({
  verifyFirebaseToken: vi.fn(),
}));

vi.mock('../src/lib/db', () => ({
  getDb: vi.fn(),
}));

import app from '../src/index';
import { verifyFirebaseToken } from '../src/lib/firebase-auth';
import { getDb } from '../src/lib/db';

const mockVerify = vi.mocked(verifyFirebaseToken);
const mockGetDb = vi.mocked(getDb);

/** Minimal mock of Worker bindings — real values unused because modules are mocked. */
const mockEnv = {
  FIREBASE_PROJECT_ID: 'test-project',
  FIREBASE_ADMIN_CLIENT_EMAIL: 'svc@test.iam.gserviceaccount.com',
  FIREBASE_ADMIN_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----\n',
  NEON_DATABASE_URL: 'postgresql://test:test@test.neon.tech/test',
};

// ─── Helper: make a mock sql tagged template function ──────────────────────
function makeMockSql(rows: unknown[] = []) {
  // Tagged template literals are plain function calls: fn(strings, ...values)
  return vi.fn().mockResolvedValue(rows);
}

// ─── Authentication middleware tests ──────────────────────────────────────
describe('Auth middleware', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await app.request('/api/v1/projects', {}, mockEnv);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns 401 when Authorization header has wrong scheme', async () => {
    const res = await app.request(
      '/api/v1/projects',
      { headers: { Authorization: 'Basic dXNlcjpwYXNz' } },
      mockEnv,
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    mockVerify.mockRejectedValue(new Error('Firebase: invalid token'));

    const res = await app.request(
      '/api/v1/projects',
      { headers: { Authorization: 'Bearer bad-token' } },
      mockEnv,
    );
    expect(res.status).toBe(401);
  });

  it('reaches the handler and returns 200 when token is valid', async () => {
    mockVerify.mockResolvedValue({ uid: 'user-123', email: null });
    // GET /projects stub returns [] without hitting the DB
    mockGetDb.mockReturnValue(makeMockSql([]) as unknown as ReturnType<typeof getDb>);

    const res = await app.request(
      '/api/v1/projects',
      { headers: { Authorization: 'Bearer valid-token' } },
      mockEnv,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ projects: [] });
  });
});

// ─── Health check (no auth) ────────────────────────────────────────────────
describe('Health check', () => {
  it('GET /healthz returns { ok: true } without auth', async () => {
    const res = await app.request('/healthz', {}, mockEnv);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});

// ─── Ownership enforcement tests ───────────────────────────────────────────
describe('Ownership enforcement', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockVerify.mockResolvedValue({ uid: 'user-a', email: null });
  });

  it('returns 404 when PATCH /projects/:id is called by a non-owner', async () => {
    // Ownership query returns no rows → user-a does not own this project
    mockGetDb.mockReturnValue(makeMockSql([]) as unknown as ReturnType<typeof getDb>);

    const res = await app.request(
      '/api/v1/projects/00000000-0000-0000-0000-000000000001',
      {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer token-for-user-a',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Unauthorized update' }),
      },
      mockEnv,
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'Not found' });
  });

  it('returns 200 when PATCH /projects/:id is called by the owner', async () => {
    // Ownership query returns a row → user-a owns the project
    mockGetDb.mockReturnValue(
      makeMockSql([{ '?column?': 1 }]) as unknown as ReturnType<typeof getDb>,
    );

    const res = await app.request(
      '/api/v1/projects/00000000-0000-0000-0000-000000000001',
      {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer token-for-user-a',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'My Living Room Reno' }),
      },
      mockEnv,
    );
    expect(res.status).toBe(200);
  });

  it('serves project-scoped materials from the project route mount', async () => {
    mockGetDb.mockReturnValue(
      makeMockSql([{ id: 'material-1', name: 'Ivory boucle' }]) as unknown as ReturnType<
        typeof getDb
      >,
    );

    const res = await app.request(
      '/api/v1/projects/00000000-0000-0000-0000-000000000001/materials',
      {
        headers: {
          Authorization: 'Bearer token-for-user-a',
        },
      },
      mockEnv,
    );

    expect(res.status).toBe(200);
    const body: unknown = await res.json();
    expect(body).toMatchObject({ materials: [{ id: 'material-1' }] });
  });
});

// ─── Input validation tests ────────────────────────────────────────────────
describe('Input validation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockVerify.mockResolvedValue({ uid: 'user-123', email: null });
  });

  it('returns 400 on POST /projects with empty name', async () => {
    const res = await app.request(
      '/api/v1/projects',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: '' }),
      },
      mockEnv,
    );
    expect(res.status).toBe(400);
  });

  it('returns 201 on POST /projects with valid body', async () => {
    mockGetDb.mockReturnValue(
      makeMockSql([
        {
          id: '00000000-0000-0000-0000-000000000001',
          owner_uid: 'user-123',
          name: 'Ocean House',
          client_name: '',
          budget_cents: 500000,
          created_at: '2026-05-01T00:00:00Z',
          updated_at: '2026-05-01T00:00:00Z',
        },
      ]) as unknown as ReturnType<typeof getDb>,
    );

    const res = await app.request(
      '/api/v1/projects',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Ocean House', budget_cents: 500000 }),
      },
      mockEnv,
    );
    expect(res.status).toBe(201);
    const body: unknown = await res.json();
    expect(body).toMatchObject({
      project: { name: 'Ocean House', budget_cents: 500000 },
    });
  });
});
