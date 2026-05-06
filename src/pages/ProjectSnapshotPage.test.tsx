import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProjectSnapshotPage } from './ProjectSnapshotPage';

vi.mock('../hooks', () => ({
  useImages: vi.fn(() => ({ data: [], isLoading: false })),
  useMaterials: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('../components/shared/ImageFrame', () => ({
  ImageFrame: ({ alt }: { alt: string }) => <div>{alt}</div>,
}));

const project = {
  id: 'project-1',
  ownerUid: 'uid-1',
  name: 'Sunset Tower',
  clientName: 'Avery Hart',
  companyName: 'Studio North',
  projectLocation: 'Los Angeles, CA',
  budgetMode: 'individual' as const,
  budgetCents: 50_000_00,
  ffeBudgetCents: 20_000_00,
  proposalBudgetCents: 15_000_00,
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-05T00:00:00Z',
};

const roomsWithItems = [
  {
    id: 'room-1',
    projectId: 'project-1',
    name: 'Lobby',
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
    items: [],
  },
];

const proposalCategoriesWithItems = [
  {
    id: 'category-1',
    projectId: 'project-1',
    name: 'Millwork',
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
    items: [],
  },
];

describe('ProjectSnapshotPage', () => {
  it('renders the snapshot summary cards', () => {
    render(
      <MemoryRouter>
        <ProjectSnapshotPage
          project={project}
          roomsWithItems={roomsWithItems}
          proposalCategoriesWithItems={proposalCategoriesWithItems}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Project Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Budget')).toBeInTheDocument();
    expect(screen.getByText('FF&E Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Proposal Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Finish Library')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /budget/i })).toHaveAttribute(
      'href',
      '/projects/project-1/budget',
    );
  });
});
