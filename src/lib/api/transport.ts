import { getCurrentIdToken } from '../auth';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: unknown = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

const buildAuthHeaders = async (init: RequestInit): Promise<Headers> => {
  const token = await getCurrentIdToken();

  const headers = new Headers(init.headers);
  if (init.body !== undefined && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token !== undefined) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return headers;
};

export const apiFetchResponse = async (path: string, init: RequestInit = {}): Promise<Response> => {
  const headers = await buildAuthHeaders(init);
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const message = typeof body['message'] === 'string' ? body['message'] : res.statusText;
    throw new ApiError(res.status, message, body);
  }

  return res;
};

export const apiFetch = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const res = await apiFetchResponse(path, init);

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  return res.json() as Promise<T>;
};
