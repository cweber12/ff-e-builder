import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProjectTabToolbarSidebar } from './ProjectTabToolbarSidebar';

const noop = vi.fn();

describe('ProjectTabToolbarSidebar', () => {
  it('renders a slim collapsed rail with context markers and reopen control', () => {
    render(
      <MemoryRouter>
        <ProjectTabToolbarSidebar
          projectId="proj-1"
          showViewToggle={true}
          isCatalogRoute={true}
          collapsed={true}
          onTogglePanel={noop}
          header={<div>Summary</div>}
          toolbarLeft={<div>Filters</div>}
          toolbarCenter={<div>Tools</div>}
          actions={<div>Actions</div>}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Open project sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open View section' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Open Context section' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Filters section' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Actions section' })).toBeInTheDocument();
  });
});
