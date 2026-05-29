import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/firebase-auth', () => ({
  verifyFirebaseToken: vi.fn(),
}));

vi.mock('../src/lib/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('../src/lib/ownership', () => ({
  assertProjectOwnership: vi.fn(),
  assertRoomOwnership: vi.fn(),
  assertItemOwnership: vi.fn(),
  assertMaterialOwnership: vi.fn(),
  assertProposalCategoryOwnership: vi.fn(),
  assertProposalItemOwnership: vi.fn(),
  getOwnedProjectContext: vi.fn(),
  getOwnedRoomContext: vi.fn(),
  getOwnedItemContext: vi.fn(),
  getOwnedMaterialContext: vi.fn(),
  getOwnedProposalItemContext: vi.fn(),
}));

import app from '../src/index';
import { getDb } from '../src/lib/db';
import { verifyFirebaseToken } from '../src/lib/firebase-auth';
import { assertProposalCategoryOwnership, getOwnedProposalItemContext } from '../src/lib/ownership';

const mockVerify = vi.mocked(verifyFirebaseToken);
const mockGetDb = vi.mocked(getDb);
const mockAssertProposalCategoryOwnership = vi.mocked(assertProposalCategoryOwnership);
const mockGetOwnedProposalItemContext = vi.mocked(getOwnedProposalItemContext);

const mockEnv = {
  FIREBASE_PROJECT_ID: 'test-project',
  FIREBASE_ADMIN_CLIENT_EMAIL: 'svc@test.iam.gserviceaccount.com',
  FIREBASE_ADMIN_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----\n',
  NEON_DATABASE_URL: 'postgresql://test:test@test.neon.tech/test',
};

describe('Proposal routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockVerify.mockResolvedValue({ uid: 'user-123', email: null });
    mockAssertProposalCategoryOwnership.mockResolvedValue(undefined);
    mockGetOwnedProposalItemContext.mockResolvedValue({
      projectId: 'project-1',
      proposalItemId: '00000000-0000-0000-0000-000000000111',
    });
  });

  it('keeps category item reads compatible with current Proposal item writes', async () => {
    const sql = vi.fn().mockResolvedValue([]);
    mockGetDb.mockReturnValue(sql as unknown as ReturnType<typeof getDb>);

    const res = await app.request(
      '/api/v1/proposal/categories/00000000-0000-0000-0000-000000000001/items',
      {
        headers: { Authorization: 'Bearer valid-token' },
      },
      mockEnv,
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ items: [] });

    const calls = sql.mock.calls as Array<[TemplateStringsArray, ...unknown[]]>;
    const statement = Array.from(calls[0]?.[0] ?? []).join(' ');
    expect(statement).toContain('proposal_items pi');
    expect(statement).toContain('proposal_item_materials');
    expect(statement).toContain('item_materials');
    expect(statement).toContain('UNION ALL');
    expect(statement).toContain('WHERE pi.category_id =');
    expect(statement).not.toContain('WITH canonical_items AS');
  });

  it('deletes a category without deleting linked canonical Generated Items', async () => {
    const sql = vi.fn().mockResolvedValue([]);
    mockGetDb.mockReturnValue(sql as unknown as ReturnType<typeof getDb>);

    const res = await app.request(
      '/api/v1/proposal/categories/00000000-0000-0000-0000-000000000001',
      {
        method: 'DELETE',
        headers: { Authorization: 'Bearer valid-token' },
      },
      mockEnv,
    );

    expect(res.status).toBe(204);

    const statements = (sql.mock.calls as Array<[TemplateStringsArray, ...unknown[]]>).map(
      ([strings]) => Array.from(strings).join(' '),
    );
    expect(statements.some((statement) => statement.includes('UPDATE items'))).toBe(true);
    expect(
      statements.some((statement) => statement.includes('SET proposal_category_id = NULL')),
    ).toBe(true);
    expect(statements.some((statement) => statement.includes('DELETE FROM proposal_items'))).toBe(
      true,
    );
    expect(
      statements.some((statement) => statement.includes('DELETE FROM proposal_categories')),
    ).toBe(true);
  });

  it('creates proposal materials with code and finish fields in create-and-assign route', async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ max_code: 8 }])
      .mockResolvedValueOnce([{ id: 'material-1' }])
      .mockResolvedValueOnce([{ next_sort: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'material-1', name: 'Imported 9' }]);
    mockGetDb.mockReturnValue(sql as unknown as ReturnType<typeof getDb>);

    const res = await app.request(
      '/api/v1/proposal/items/00000000-0000-0000-0000-000000000111/materials/new',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Imported 9',
          code: '',
          finish_id: '00000000-0000-0000-0000-000000000222',
          material_type: 'veneer',
          material_id: 'MAT-009',
          description: 'Auto-created from paste',
        }),
      },
      mockEnv,
    );

    expect(res.status).toBe(201);
    const statements = (sql.mock.calls as Array<[TemplateStringsArray, ...unknown[]]>).map(
      ([strings]) => Array.from(strings).join(' '),
    );
    const insertStatement = statements.find((statement) =>
      statement.includes('INSERT INTO materials'),
    );
    expect(insertStatement).toContain('code');
    expect(insertStatement).toContain('finish_id');
    expect(insertStatement).toContain('material_type');
  });
});
