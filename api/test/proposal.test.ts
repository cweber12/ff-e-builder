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
import { assertProposalCategoryOwnership } from '../src/lib/ownership';

const mockVerify = vi.mocked(verifyFirebaseToken);
const mockGetDb = vi.mocked(getDb);
const mockAssertProposalCategoryOwnership = vi.mocked(assertProposalCategoryOwnership);

const mockEnv = {
  FIREBASE_PROJECT_ID: 'test-project',
  FIREBASE_ADMIN_CLIENT_EMAIL: 'svc@test.iam.gserviceaccount.com',
  FIREBASE_ADMIN_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----\n',
  NEON_DATABASE_URL: 'postgresql://test:test@test.neon.tech/test',
};

describe('Proposal routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockVerify.mockResolvedValue({ uid: 'user-123' });
    mockAssertProposalCategoryOwnership.mockResolvedValue(undefined);
  });

  it('loads category items through the renamed proposal item-material join column', async () => {
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
    expect(statement).toContain('FROM  proposal_items pi');
    expect(statement).toContain(
      'LEFT  JOIN proposal_item_materials pim ON pim.proposal_item_id = pi.id',
    );
  });
});
