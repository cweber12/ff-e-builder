import { apiFetch } from './transport';
import type { Company } from '../../types';

export interface RawCompany {
  id: string;
  owner_uid: string;
  name: string;
  location: string | null;
  color_primary: string | null;
  color_secondary: string | null;
  color_accent: string | null;
  mark_enabled: boolean;
  mark_include_name: boolean;
  mark_placement_h: 'left' | 'center' | 'right';
  mark_placement_v: 'header' | 'footer';
  mark_opacity: number;
  created_at: string;
  updated_at: string;
}

export interface UpsertCompanyInput {
  name: string;
  location?: string | null;
  colorPrimary?: string | null;
  colorSecondary?: string | null;
  colorAccent?: string | null;
  markEnabled?: boolean;
  markIncludeName?: boolean;
  markPlacementH?: 'left' | 'center' | 'right';
  markPlacementV?: 'header' | 'footer';
  markOpacity?: number;
}

export function mapCompany(r: RawCompany): Company {
  return {
    id: r.id,
    ownerId: r.owner_uid,
    name: r.name,
    location: r.location,
    colorPrimary: r.color_primary,
    colorSecondary: r.color_secondary,
    colorAccent: r.color_accent,
    markEnabled: r.mark_enabled,
    markIncludeName: r.mark_include_name,
    markPlacementH: r.mark_placement_h,
    markPlacementV: r.mark_placement_v,
    markOpacity: r.mark_opacity,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const companyApi = {
  get: (): Promise<Company | null> =>
    apiFetch<{ company: RawCompany | null }>('/api/v1/company').then((r) =>
      r.company ? mapCompany(r.company) : null,
    ),

  upsert: (input: UpsertCompanyInput): Promise<Company> =>
    apiFetch<{ company: RawCompany }>('/api/v1/company', {
      method: 'PUT',
      body: JSON.stringify({
        name: input.name,
        location: input.location,
        color_primary: input.colorPrimary,
        color_secondary: input.colorSecondary,
        color_accent: input.colorAccent,
        mark_enabled: input.markEnabled,
        mark_include_name: input.markIncludeName,
        mark_placement_h: input.markPlacementH,
        mark_placement_v: input.markPlacementV,
        mark_opacity: input.markOpacity,
      }),
    }).then((r) => mapCompany(r.company)),
};
