import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProjectHeader } from './ProjectHeader';
import type { Project } from '../types';
import type { ReactElement } from 'react';

const renderWithRouter = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

const makeProject = (overrides?: Partial<Project>): Project => ({
  id: 'proj-1',
  ownerUid: 'uid-1',
  name: 'Living Room Reno',
  clientName: 'Jane Smith',
  budgetCents: 25_000_000, // $250,000
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  ...overrides,
});

describe('ProjectHeader', () => {
  it('shows shimmer skeleton while project is undefined', () => {
    const { container } = render(
      <ProjectHeader
        project={undefined}
        actualCents={0}
        onNameSave={vi.fn()}
        onClientSave={vi.fn()}
        onBudgetSave={vi.fn()}
      />,
    );
    // Skeleton uses animate-pulse
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByText('Living Room Reno')).not.toBeInTheDocument();
  });

  it('renders project name and client name', () => {
    renderWithRouter(
      <ProjectHeader
        project={makeProject()}
        actualCents={18_742_00}
        onNameSave={vi.fn()}
        onClientSave={vi.fn()}
        onBudgetSave={vi.fn()}
      />,
    );
    expect(screen.getByText('Living Room Reno')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('renders three budget values formatted as currency', () => {
    renderWithRouter(
      <ProjectHeader
        project={makeProject({ budgetCents: 25_000_000 })}
        actualCents={18_742_000}
        onNameSave={vi.fn()}
        onClientSave={vi.fn()}
        onBudgetSave={vi.fn()}
      />,
    );
    // Budget $250,000
    expect(screen.getByText(/250,000/)).toBeInTheDocument();
    // Actual $187,420
    expect(screen.getByText(/187,420/)).toBeInTheDocument();
    // Remaining = $62,580
    expect(screen.getByText(/62,580/)).toBeInTheDocument();
  });

  it('shows red color when over budget', () => {
    const { container } = renderWithRouter(
      <ProjectHeader
        project={makeProject({ budgetCents: 10_000_000 })}
        actualCents={15_000_000} // $150k actual on $100k budget
        onNameSave={vi.fn()}
        onClientSave={vi.fn()}
        onBudgetSave={vi.fn()}
      />,
    );
    // Remaining is negative — red-300 class should appear
    const remainingEl = container.querySelector('.text-red-100');
    expect(remainingEl).toBeInTheDocument();
  });

  it('shows warning icon when over budget', () => {
    renderWithRouter(
      <ProjectHeader
        project={makeProject({ budgetCents: 10_000_000 })}
        actualCents={12_000_000}
        onNameSave={vi.fn()}
        onClientSave={vi.fn()}
        onBudgetSave={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Over budget')).toBeInTheDocument();
  });

  it('shows "Set budget" CTA when budget is zero', () => {
    renderWithRouter(
      <ProjectHeader
        project={makeProject({ budgetCents: 0 })}
        actualCents={0}
        onNameSave={vi.fn()}
        onClientSave={vi.fn()}
        onBudgetSave={vi.fn()}
      />,
    );
    expect(screen.getByText('Set budget')).toBeInTheDocument();
  });

  it('calls onNameSave with new value when edited', async () => {
    const user = userEvent.setup();
    const onNameSave = vi.fn().mockResolvedValue(undefined);
    renderWithRouter(
      <ProjectHeader
        project={makeProject()}
        actualCents={0}
        onNameSave={onNameSave}
        onClientSave={vi.fn()}
        onBudgetSave={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Project name' }));
    const input = screen.getByRole('textbox', { name: 'Project name' });
    await user.clear(input);
    await user.type(input, 'New Name');
    await user.keyboard('{Enter}');
    expect(onNameSave).toHaveBeenCalledWith('New Name');
  });
});
