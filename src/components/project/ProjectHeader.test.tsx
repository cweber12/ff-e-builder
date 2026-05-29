import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProjectHeader } from './ProjectHeader';
import type { Project } from '../../types';
import type { ReactElement } from 'react';

const renderWithRouter = (ui: ReactElement, initialEntries: string[] = ['/']) =>
  render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);

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

    expect(container.querySelector('[class*="animate-pulse"]')).toBeInTheDocument();
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

  it('marks the selected tab as active and mirrors it in the toolbar header', () => {
    renderWithRouter(<ProjectHeader project={makeProject()} />, [
      '/projects/proj-1/proposal/table',
    ]);

    const tabNav = screen.getByRole('navigation', { name: 'Project tools' });
    expect(within(tabNav).getByRole('link', { name: 'Proposal' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('heading', { name: 'Proposal' })).toBeInTheDocument();
  });

  it('does not render project options in the top-right cluster', () => {
    renderWithRouter(<ProjectHeader project={makeProject()} />);

    expect(
      screen.queryByRole('button', { name: 'Open options for Living Room Reno' }),
    ).not.toBeInTheDocument();
  });
});
