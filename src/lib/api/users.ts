import { apiFetch } from './transport';
import { mapUserProfile, type RawUserProfile } from './mappers';
import type { UserProfile } from '../../types';

export type UpsertUserProfileInput = {
  name?: string;
  email?: string;
  phone?: string;
  companyName?: string;
};

export const usersApi = {
  me: (): Promise<UserProfile> =>
    apiFetch<{ profile: RawUserProfile }>('/api/v1/users/me').then((r) =>
      mapUserProfile(r.profile),
    ),

  updateMe: (input: UpsertUserProfileInput): Promise<UserProfile> =>
    apiFetch<{ profile: RawUserProfile }>('/api/v1/users/me', {
      method: 'PUT',
      body: JSON.stringify({
        name: input.name ?? '',
        email: input.email ?? '',
        phone: input.phone ?? '',
        company_name: input.companyName ?? '',
      }),
    }).then((r) => mapUserProfile(r.profile)),
};
