import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, setupApiTest } from './test-utils';
import { usersApi } from './users';

setupApiTest();

describe('usersApi', () => {
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

    const profile = await usersApi.updateMe({
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
