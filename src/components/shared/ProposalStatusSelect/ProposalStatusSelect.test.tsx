import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProposalStatusSelect } from './ProposalStatusSelect';

describe('ProposalStatusSelect compact mode', () => {
  it('uses confirmation modal before applying a status change', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn(async () => {});

    render(<ProposalStatusSelect status="in_progress" onChange={onChange} compact />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Proposal status' }), [
      'pricing_complete',
    ]);

    expect(screen.getByText('Mark proposal as Pricing complete?')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Mark as Pricing complete' }));
    expect(onChange).toHaveBeenCalledWith('pricing_complete');
  });

  it('disables blocked forward stages when revision issues are unresolved', () => {
    render(
      <ProposalStatusSelect
        status="pricing_complete"
        onChange={vi.fn()}
        compact
        revisionGuard={{ openRevisionLabel: '2', unresolvedCount: 3 }}
      />,
    );

    const statusSelect = screen.getByRole('combobox', { name: 'Proposal status' });
    const submittedOption = screen.getByRole('option', { name: 'Submitted' });
    const approvedOption = screen.getByRole('option', { name: 'Approved' });
    const draftOption = screen.getByRole('option', { name: 'Draft' });

    expect(statusSelect).toBeInTheDocument();
    expect(submittedOption).toBeDisabled();
    expect(approvedOption).toBeDisabled();
    expect(draftOption).not.toBeDisabled();
  });

  it('renders a blocked-action shortcut when revision issues are unresolved', async () => {
    const user = userEvent.setup();
    const onBlockedAction = vi.fn();

    render(
      <ProposalStatusSelect
        status="in_progress"
        onChange={vi.fn()}
        compact
        revisionGuard={{ openRevisionLabel: '2', unresolvedCount: 3 }}
        blockedAction={{
          label: 'Open flagged items in Spreadsheet View',
          onClick: onBlockedAction,
        }}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Open flagged items in Spreadsheet View' }),
    );

    expect(onBlockedAction).toHaveBeenCalledTimes(1);
  });
});
