import { apiFetch } from './transport';
import { mapProject, type RawProject } from './mappers';
import type { Project } from '../../types';
import type { ProposalStatus } from '../../types';

export type CreateProjectInput = {
  name: string;
  clientName?: string;
  companyName?: string;
  projectLocation?: string;
  budgetMode?: 'shared' | 'individual';
  budgetCents?: number;
  ffeBudgetCents?: number;
  proposalBudgetCents?: number;
};

export type UpdateProjectInput = {
  name?: string;
  clientName?: string;
  companyName?: string;
  projectLocation?: string;
  budgetMode?: 'shared' | 'individual';
  budgetCents?: number;
  ffeBudgetCents?: number;
  proposalBudgetCents?: number;
  proposalStatus?: ProposalStatus;
};

export const projectsApi = {
  list: (): Promise<Project[]> =>
    apiFetch<{ projects: RawProject[] }>('/api/v1/projects').then((r) =>
      r.projects.map(mapProject),
    ),

  create: (input: CreateProjectInput): Promise<Project> =>
    apiFetch<{ project: RawProject }>('/api/v1/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        client_name: input.clientName ?? '',
        company_name: input.companyName ?? '',
        project_location: input.projectLocation ?? '',
        budget_mode: input.budgetMode ?? 'shared',
        budget_cents: input.budgetCents ?? 0,
        ffe_budget_cents: input.ffeBudgetCents ?? 0,
        proposal_budget_cents: input.proposalBudgetCents ?? 0,
      }),
    }).then((r) => mapProject(r.project)),

  update: (id: string, patch: UpdateProjectInput): Promise<Project> =>
    apiFetch<{ project: RawProject }>(`/api/v1/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: patch.name,
        client_name: patch.clientName,
        company_name: patch.companyName,
        project_location: patch.projectLocation,
        budget_mode: patch.budgetMode,
        budget_cents: patch.budgetCents,
        ffe_budget_cents: patch.ffeBudgetCents,
        proposal_budget_cents: patch.proposalBudgetCents,
        proposal_status: patch.proposalStatus,
      }),
    }).then((r) => mapProject(r.project)),

  delete: (id: string): Promise<void> =>
    apiFetch<void>(`/api/v1/projects/${id}`, { method: 'DELETE' }),
};
