import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProjectHeader } from './ProjectHeader';
import type { Project } from '../../types';
import type { ReactElement } from 'react';

const renderWithRouter = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

const makeProject = (overrides?: Partial<Project>): Project => ({
  id: 'proj-1',
  ownerUid: 'uid-1',
  name: 'Living Room Reno',
  clientName: 'Jane Smith',
  companyName: 'ChillDesignStudio',
  projectLocation: 'Los Angeles, CA',
  budgetCents: 25_000_000,
  proposalStatus: 'in_progress',
  proposalStatusUpdatedAt: '2024-01-01T00:00:00Z',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  ...overrides,
});

describe('ProjectHeader', () => {
  it('shows shimmer skeleton while project is undefined', () => {
    const { container } = renderWithRouter(<ProjectHeader project={undefined} />);

    // SkeletonBar uses bg-neutral-200 animated placeholders (no animate-pulse class in new design)
    expect(container.querySelector('[class*="bg-neutral-200"]')).toBeInTheDocument();
    expect(screen.queryByText('Living Room Reno')).not.toBeInTheDocument();
  });

  it('renders the project name', () => {
    renderWithRouter(<ProjectHeader project={makeProject()} />);

    expect(screen.getByText('Living Room Reno')).toBeInTheDocument();
  });

  it('does not render editable project fields or budget controls', () => {
    renderWithRouter(<ProjectHeader project={makeProject()} />);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/Set budget/i)).not.toBeInTheDocument();
  });

  it('renders project tab navigation', () => {
    renderWithRouter(<ProjectHeader project={makeProject()} />);

    expect(screen.getByRole('link', { name: 'FF&E' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Proposal' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Plans' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Materials' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Budget' })).toBeInTheDocument();
  });

  it('renders project options when handlers are provided', () => {
    renderWithRouter(
      <ProjectHeader
        project={makeProject()}
        optionsOpen
        onToggleOptions={() => undefined}
        onEditProject={() => undefined}
        onProjectImages={() => undefined}
        onDeleteProject={() => undefined}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Open options for Living Room Reno' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update project' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Project images' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete project' })).toBeInTheDocument();
  });
});
