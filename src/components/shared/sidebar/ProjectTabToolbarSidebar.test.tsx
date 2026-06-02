import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProjectTabToolbarSidebar } from './ProjectTabToolbarSidebar';

const noop = vi.fn();

describe('ProjectTabToolbarSidebar', () => {
  it('renders a slim collapsed rail with only the reopen control', () => {
    render(
      <MemoryRouter>
        <ProjectTabToolbarSidebar
          sidebarTitle="FF&E"
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
    expect(screen.queryByRole('button', { name: /Open .* section/i })).not.toBeInTheDocument();
  });

  it('does not render an in-sidebar collapse toggle when expanded', () => {
    render(
      <MemoryRouter>
        <ProjectTabToolbarSidebar
          sidebarTitle="FF&E"
          collapsed={false}
          onTogglePanel={noop}
          headerLeft={<button type="button">Options</button>}
          headerRight={<button type="button">Catalog</button>}
          header={<div>Summary</div>}
          toolbarLeft={<div>Filters</div>}
          toolbarCenter={<div>Tools</div>}
          actions={<div>Actions</div>}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Collapse project sidebar' })).toBeNull();
  });

  it('renders header-left and header-right controls when expanded', () => {
    render(
      <MemoryRouter>
        <ProjectTabToolbarSidebar
          sidebarTitle="FF&E"
          collapsed={false}
          onTogglePanel={noop}
          headerLeft={<button type="button">Options</button>}
          headerRight={<button type="button">Catalog</button>}
          header={<div>Summary</div>}
          toolbarLeft={<div>Filters</div>}
          toolbarCenter={<div>Tools</div>}
          actions={<div>Actions</div>}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Options' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Catalog' })).toBeInTheDocument();
  });
});
