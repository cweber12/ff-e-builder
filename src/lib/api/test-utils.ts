import { afterEach, beforeEach, vi } from 'vitest';

const hoistedAuth = vi.hoisted(() => ({
  currentUser: null as null | { getIdToken: (force: boolean) => Promise<string> },
}));

export const mockAuth = hoistedAuth;

vi.mock('../auth', () => ({
  auth: mockAuth,
  getCurrentIdToken: () => mockAuth.currentUser?.getIdToken(false),
}));

vi.mock('../compress-image', () => ({
  compressImage: (file: File) => Promise.resolve(file),
}));

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const setupApiTest = () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    mockAuth.currentUser = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
};
