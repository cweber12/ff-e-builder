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
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  ...overrides,
});

describe('ProjectHeader', () => {
  it('shows shimmer skeleton while project is undefined', () => {
    const { container } = render(<ProjectHeader project={undefined} />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByText('Living Room Reno')).not.toBeInTheDocument();
  });

  it('renders read-only project identity and included metadata', () => {
    renderWithRouter(<ProjectHeader project={makeProject()} />);

    expect(screen.getByRole('heading', { name: 'Living Room Reno' })).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Company: ChillDesignStudio')).toBeInTheDocument();
    expect(screen.getByText('Location: Los Angeles, CA')).toBeInTheDocument();
  });

  it('omits empty metadata values', () => {
    renderWithRouter(
      <ProjectHeader
        project={makeProject({ clientName: '', companyName: '', projectLocation: '' })}
      />,
    );

    expect(screen.queryByText(/Company:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Location:/)).not.toBeInTheDocument();
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
  });

  it('does not render editable project fields or budget controls', () => {
    renderWithRouter(<ProjectHeader project={makeProject()} />);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/Budget/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Set budget/i)).not.toBeInTheDocument();
  });

  it('renders project tool navigation', () => {
    renderWithRouter(<ProjectHeader project={makeProject()} />);

    expect(screen.getByRole('link', { name: 'All projects' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'FF&E' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Take-Off Table' })).toBeInTheDocument();
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
