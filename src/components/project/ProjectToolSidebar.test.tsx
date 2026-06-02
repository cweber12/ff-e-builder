import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Project } from '../../types';
import { ProjectToolSidebar } from './ProjectToolSidebar';

const makeProject = (): Project => ({
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
});

describe('ProjectToolSidebar', () => {
  it('renders the project tool links and marks the active route', () => {
    render(
      <MemoryRouter initialEntries={['/projects/proj-1/materials']}>
        <ProjectToolSidebar project={makeProject()} />
      </MemoryRouter>,
    );

    const sidebar = screen.getByRole('complementary', { name: 'Project navigation' });
    const nav = within(sidebar).getByRole('navigation', { name: 'Project tools' });

    expect(within(nav).getByRole('link', { name: 'FF&E' })).toHaveAttribute(
      'href',
      '/projects/proj-1/ffe/catalog',
    );
    expect(within(nav).getByRole('link', { name: 'Materials' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
