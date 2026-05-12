import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlanUploadPanel } from './PlanUploadPanel';

describe('PlanUploadPanel', () => {
  it('renders upload fields and keeps submit disabled until a plan source is selected', () => {
    render(<PlanUploadPanel creating={false} onCreatePlan={vi.fn()} />);

    expect(screen.getByText('Add a Measured Plan')).toBeInTheDocument();
    expect(screen.getByLabelText('Plan name')).toBeInTheDocument();
    expect(screen.getByLabelText('Sheet reference')).toBeInTheDocument();
    expect(screen.getByLabelText('Plan source')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload plan' })).toBeDisabled();
  });
});
