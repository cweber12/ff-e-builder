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
  assertFinishOwnership: vi.fn(),
  assertProposalCategoryOwnership: vi.fn(),
  assertProposalItemOwnership: vi.fn(),
  getOwnedProjectContext: vi.fn(),
  getOwnedRoomContext: vi.fn(),
  getOwnedItemContext: vi.fn(),
  getOwnedMaterialContext: vi.fn(),
  getOwnedFinishContext: vi.fn(),
  getOwnedProposalItemContext: vi.fn(),
  getOwnedCompanyContext: vi.fn(),
}));

import app from '../src/index';
import { getDb } from '../src/lib/db';
import { verifyFirebaseToken } from '../src/lib/firebase-auth';
import { assertProjectOwnership } from '../src/lib/ownership';

const mockVerify = vi.mocked(verifyFirebaseToken);
const mockGetDb = vi.mocked(getDb);
const mockAssertProjectOwnership = vi.mocked(assertProjectOwnership);

const projectId = '00000000-0000-0000-0000-000000000001';
const bucketPut = vi.fn().mockResolvedValue(undefined);
const bucketDelete = vi.fn().mockResolvedValue(undefined);
type SqlMock = ReturnType<typeof getDb> &
  ReturnType<typeof vi.fn> & {
    transaction: ReturnType<typeof vi.fn>;
  };

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

function makeSqlMock(): SqlMock {
  const transaction = vi.fn().mockResolvedValue([]);
  const sql = vi.fn().mockResolvedValue([
    {
      id: 'document-1',
      project_id: projectId,
      owner_uid: 'user-123',
      name: 'Level 2 Furniture Plan',
      source_type: 'image',
      source_r2_key: 'source-key',
      source_filename: 'level-2.png',
      source_content_type: 'image/png',
      source_byte_size: 11,
      cover_measured_plan_id: 'sheet-1',
      created_at: '2026-06-11T00:00:00.000Z',
      updated_at: '2026-06-11T00:00:00.000Z',
    },
  ]);
  return Object.assign(sql, { transaction });
}

describe('Plan document uploads', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    bucketPut.mockResolvedValue(undefined);
    bucketDelete.mockResolvedValue(undefined);
    mockVerify.mockResolvedValue({ uid: 'user-123', email: null });
    mockAssertProjectOwnership.mockResolvedValue(undefined);
  });

  it('creates a one-sheet image document in one transaction and reuses the source image key', async () => {
    const sql = makeSqlMock();
    mockGetDb.mockReturnValue(sql);

    const body = new FormData();
    body.append('document_name', 'Level 2 Furniture Plan');
    body.append(
      'sheets_json',
      JSON.stringify([
        {
          clientSheetId: 'image-1',
          sheetIndex: 1,
          name: 'Level 2 Furniture Plan',
          sheetReference: 'A1.02',
        },
      ]),
    );
    body.append('source_file', new File(['image-bytes'], 'level-2.png', { type: 'image/png' }));

    const res = await app.fetch(
      new Request(`http://localhost/api/v1/projects/${projectId}/plan-documents`, {
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
        body,
      }),
      mockEnv,
    );

    expect(res.status).toBe(201);
    expect(bucketPut).toHaveBeenCalledTimes(1);
    expect(bucketDelete).not.toHaveBeenCalled();
    expect(sql.transaction).toHaveBeenCalledTimes(1);
    const statements = (sql.mock.calls as Array<[TemplateStringsArray, ...unknown[]]>).map(
      ([strings]) => Array.from(strings).join(' '),
    );
    expect(statements?.[0]).toContain('INSERT INTO plan_documents');
    expect(statements?.[1]).toContain('INSERT INTO measured_plans');
    expect(statements?.[1]).toContain('plan_document_id');
  });

  it('rejects PDF document sheets without render files before uploading to R2', async () => {
    const sql = makeSqlMock();
    mockGetDb.mockReturnValue(sql);

    const body = new FormData();
    body.append('document_name', 'Architectural Set');
    body.append(
      'sheets_json',
      JSON.stringify([
        {
          clientSheetId: 'page-1',
          sheetIndex: 1,
          name: 'Cover',
          sheetReference: 'A0.01',
          pdfPageNumber: 1,
          pdfPageWidthPt: 612,
          pdfPageHeightPt: 792,
          pdfRenderScale: 2,
          pdfRenderedWidthPx: 1224,
          pdfRenderedHeightPx: 1584,
          pdfRotation: 0,
        },
      ]),
    );
    body.append(
      'source_file',
      new File(['pdf-bytes'], 'drawings.pdf', { type: 'application/pdf' }),
    );

    const res = await app.fetch(
      new Request(`http://localhost/api/v1/projects/${projectId}/plan-documents`, {
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
        body,
      }),
      mockEnv,
    );

    expect(res.status).toBe(400);
    expect(bucketPut).not.toHaveBeenCalled();
    expect(sql.transaction).not.toHaveBeenCalled();
  });

  it('updates document metadata and cover sheet after validating sheet ownership', async () => {
    const sql = makeSqlMock();
    sql
      .mockResolvedValueOnce([
        {
          id: 'document-1',
          project_id: projectId,
          owner_uid: 'user-123',
          name: 'Architectural Set',
          source_type: 'pdf',
          source_r2_key: 'source-key',
          source_filename: 'drawings.pdf',
          source_content_type: 'application/pdf',
          source_byte_size: 11,
          cover_measured_plan_id: 'sheet-1',
          created_at: '2026-06-11T00:00:00.000Z',
          updated_at: '2026-06-11T00:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([{ id: 'sheet-2' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'document-1',
          project_id: projectId,
          owner_uid: 'user-123',
          name: 'Architectural Set - Revision 2',
          source_type: 'pdf',
          source_r2_key: 'source-key',
          source_filename: 'drawings.pdf',
          source_content_type: 'application/pdf',
          source_byte_size: 11,
          cover_measured_plan_id: 'sheet-2',
          sheet_count: 2,
          calibrated_sheet_count: 1,
          measurement_count: 3,
          created_at: '2026-06-11T00:00:00.000Z',
          updated_at: '2026-06-12T00:00:00.000Z',
        },
      ]);
    mockGetDb.mockReturnValue(sql);

    const res = await app.fetch(
      new Request(`http://localhost/api/v1/projects/${projectId}/plan-documents/document-1`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Architectural Set - Revision 2',
          cover_measured_plan_id: 'sheet-2',
        }),
      }),
      mockEnv,
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      document: {
        id: 'document-1',
        name: 'Architectural Set - Revision 2',
        cover_measured_plan_id: 'sheet-2',
        sheet_count: 2,
      },
    });
    const statements = (sql.mock.calls as Array<[TemplateStringsArray, ...unknown[]]>).map(
      ([strings]) => Array.from(strings).join(' '),
    );
    expect(statements.some((statement) => statement.includes('UPDATE plan_documents'))).toBe(true);
  });
});
