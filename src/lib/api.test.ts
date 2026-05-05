import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist a mutable auth stub so it's available inside the vi.mock factory
const mockAuth = vi.hoisted(() => ({
  currentUser: null as null | { getIdToken: (force: boolean) => Promise<string> },
}));

vi.mock('./auth', () => ({
  auth: mockAuth,
  getCurrentIdToken: () => mockAuth.currentUser?.getIdToken(false),
}));

vi.mock('./compress-image', () => ({
  compressImage: (file: File) => Promise.resolve(file),
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

    const images = await api.images.list({ entityType: 'project', entityId: 'project-1' });

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
    await api.images.upload({ entityType: 'project', entityId: 'project-1', file });

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

    const result = await api.images.getContentBlob('img-1');

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

    const image = await api.images.setCrop('img-1', {
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

describe('api client - users', () => {
  it('updates the current user profile with worker field names', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        profile: {
          owner_uid: 'uid-1',
          name: 'Cole',
          email: 'cole@example.com',
          phone: '555-0100',
          company_name: 'Chill Design Studio',
          created_at: '2026-05-01T00:00:00Z',
          updated_at: '2026-05-02T00:00:00Z',
        },
      }),
    );

    const profile = await api.users.updateMe({
      name: 'Cole',
      email: 'cole@example.com',
      phone: '555-0100',
      companyName: 'Chill Design Studio',
    });

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(init?.method).toBe('PUT');
    expect(typeof init?.body).toBe('string');
    expect(JSON.parse(init?.body as string)).toEqual({
      name: 'Cole',
      email: 'cole@example.com',
      phone: '555-0100',
      company_name: 'Chill Design Studio',
    });
    expect(profile).toMatchObject({
      ownerUid: 'uid-1',
      companyName: 'Chill Design Studio',
    });
  });
});

describe('api client - rooms', () => {
  it('creates rooms under a project with worker field names', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        {
          room: {
            id: 'room-1',
            project_id: 'project-1',
            name: 'Living Room',
            sort_order: 2,
            created_at: '2026-05-01T00:00:00Z',
            updated_at: '2026-05-02T00:00:00Z',
          },
        },
        201,
      ),
    );

    const room = await api.rooms.create('project-1', {
      name: 'Living Room',
      sortOrder: 2,
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/projects/project-1/rooms'),
      expect.objectContaining({ method: 'POST' }),
    );
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(typeof init?.body).toBe('string');
    expect(JSON.parse(init?.body as string)).toEqual({
      name: 'Living Room',
      sort_order: 2,
    });
    expect(room).toMatchObject({
      id: 'room-1',
      projectId: 'project-1',
      sortOrder: 2,
    });
  });
});

describe('api client - items', () => {
  it('updates items with worker field names and the current version', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        item: {
          id: 'item-1',
          room_id: 'room-2',
          item_name: 'Lounge Chair',
          category: 'Seating',
          vendor: null,
          model: null,
          item_id_tag: null,
          dimensions: null,
          seat_height: null,
          finishes: null,
          notes: null,
          qty: 2,
          unit_cost_cents: 125000,
          markup_pct: '20.00',
          lead_time: null,
          status: 'approved',
          image_url: null,
          link_url: null,
          sort_order: 4,
          version: 8,
          created_at: '2026-05-01T00:00:00Z',
          updated_at: '2026-05-02T00:00:00Z',
        },
      }),
    );

    const item = await api.items.update('item-1', {
      roomId: 'room-2',
      itemName: 'Lounge Chair',
      qty: 2,
      unitCostCents: 125000,
      markupPct: 20,
      status: 'approved',
      sortOrder: 4,
      version: 7,
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/items/item-1'),
      expect.objectContaining({ method: 'PATCH' }),
    );
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(typeof init?.body).toBe('string');
    expect(JSON.parse(init?.body as string)).toMatchObject({
      item_name: 'Lounge Chair',
      room_id: 'room-2',
      qty: 2,
      unit_cost_cents: 125000,
      markup_pct: 20,
      status: 'approved',
      sort_order: 4,
      version: 7,
    });
    expect(item).toMatchObject({
      id: 'item-1',
      roomId: 'room-2',
      itemName: 'Lounge Chair',
      markupPct: 20,
      version: 8,
    });
  });
});

describe('api client - materials', () => {
  it('creates project materials with default swatch metadata', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        {
          material: {
            id: 'material-1',
            project_id: 'project-1',
            name: 'Walnut',
            material_id: 'WD-01',
            description: 'Natural walnut',
            swatch_hex: '#D9D4C8',
            created_at: '2026-05-01T00:00:00Z',
            updated_at: '2026-05-02T00:00:00Z',
          },
        },
        201,
      ),
    );

    const material = await api.materials.create('project-1', {
      name: 'Walnut',
      materialId: 'WD-01',
      description: 'Natural walnut',
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/projects/project-1/materials'),
      expect.objectContaining({ method: 'POST' }),
    );
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(typeof init?.body).toBe('string');
    expect(JSON.parse(init?.body as string)).toEqual({
      name: 'Walnut',
      material_id: 'WD-01',
      description: 'Natural walnut',
      swatch_hex: '#D9D4C8',
    });
    expect(material).toMatchObject({
      id: 'material-1',
      projectId: 'project-1',
      materialId: 'WD-01',
      swatchHex: '#D9D4C8',
    });
  });

  it('updates proposal item material assignments without swatch metadata', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        material: {
          id: 'material-1',
          project_id: 'project-1',
          name: 'Oak',
          material_id: 'WD-02',
          description: 'White oak',
          swatch_hex: '#C8B99A',
          created_at: '2026-05-01T00:00:00Z',
          updated_at: '2026-05-02T00:00:00Z',
        },
      }),
    );

    await api.materials.updateForProposalItem('proposal-item-1', 'material-1', {
      name: 'Oak',
      materialId: 'WD-02',
      description: 'White oak',
      swatchHex: '#FFFFFF',
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/proposal/items/proposal-item-1/materials/material-1'),
      expect.objectContaining({ method: 'PATCH' }),
    );
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(typeof init?.body).toBe('string');
    expect(JSON.parse(init?.body as string)).toEqual({
      name: 'Oak',
      material_id: 'WD-02',
      description: 'White oak',
    });
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
