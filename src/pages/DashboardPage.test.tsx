import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DashboardPage } from './DashboardPage';

const PROJECT = {
  id: 'proj-1',
  ownerUid: 'uid-1',
  name: 'Living Room Reno',
  clientName: 'Jane Smith',
  companyName: 'ChillDesignStudio',
  projectLocation: 'Los Angeles, CA',
  budgetMode: 'shared' as const,
  budgetCents: 0,
  ffeBudgetCents: 0,
  proposalBudgetCents: 0,
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-04T00:00:00Z',
};

vi.mock('../hooks', () => ({
  useProjects: vi.fn(() => ({ data: [PROJECT], isLoading: false })),
  useUpdateProject: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useDeleteProject: vi.fn(() => ({ mutate: vi.fn() })),
  useUserProfile: vi.fn(() => ({ data: { name: 'Casey Designer' } })),
}));

vi.mock('../components/project/modals/NewProjectModal', () => ({
  NewProjectModal: () => null,
}));

vi.mock('../components/project/modals/EditProjectModal', () => ({
  EditProjectModal: () => null,
}));

vi.mock('../components/project/modals/DeleteProjectModal', () => ({
  DeleteProjectModal: () => null,
}));

vi.mock('../components/project/modals/ProjectImagesModal', () => ({
  ProjectImagesModal: () => null,
}));

vi.mock('../components/shared/image/ImageFrame', () => ({
  ImageFrame: ({ alt }: { alt: string }) => <div>{alt}</div>,
}));

vi.mock('../components/project/ProjectOptionsMenu', () => ({
  ProjectOptionsMenu: ({ projectName }: { projectName: string }) => (
    <button type="button">{`Options for ${projectName}`}</button>
  ),
}));

describe('DashboardPage', () => {
  it('opens projects through the snapshot route and removes tool shortcut links', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Open Living Room Reno snapshot' })).toHaveAttribute(
      'href',
      '/projects/proj-1/snapshot',
    );
    expect(screen.queryByRole('link', { name: 'FF&E' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Proposal' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Options for Living Room Reno' }),
    ).toBeInTheDocument();
  });
});
