import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InlineNumberEdit } from './InlineNumberEdit';

const fmt = (n: number) => `$${n.toFixed(2)}`;

describe('InlineNumberEdit', () => {
  it('renders formatted value initially', () => {
    render(<InlineNumberEdit value={1000} onSave={vi.fn()} formatter={fmt} />);
    expect(screen.getByText('$1000.00')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('single click does NOT enter edit mode on the value text', async () => {
    const user = userEvent.setup();
    render(<InlineNumberEdit value={1000} onSave={vi.fn()} formatter={fmt} aria-label="Budget" />);
    // Click the value span — not the pencil button
    await user.click(screen.getByText('$1000.00'));
    // Should still show value text, NOT an input
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('double-click on value area enters edit mode', async () => {
    const user = userEvent.setup();
    render(<InlineNumberEdit value={1000} onSave={vi.fn()} formatter={fmt} aria-label="Budget" />);
    await user.dblClick(screen.getByText('$1000.00'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('clicking pencil icon enters edit mode (single click is OK on the icon)', async () => {
    const user = userEvent.setup();
    render(<InlineNumberEdit value={1000} onSave={vi.fn()} formatter={fmt} aria-label="Budget" />);
    // Hover to make pencil visible, then click it
    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('Enter saves parsed numeric value', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<InlineNumberEdit value={1000} onSave={onSave} formatter={fmt} aria-label="Budget" />);
    await user.dblClick(screen.getByText('$1000.00'));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, '2500');
    await user.keyboard('{Enter}');
    expect(onSave).toHaveBeenCalledWith(2500);
  });

  it('Escape cancels without saving', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<InlineNumberEdit value={1000} onSave={onSave} formatter={fmt} aria-label="Budget" />);
    await user.dblClick(screen.getByText('$1000.00'));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, '9999');
    await user.keyboard('{Escape}');
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('$1000.00')).toBeInTheDocument();
  });

  it('shows validation error for non-numeric input', async () => {
    const user = userEvent.setup();
    render(<InlineNumberEdit value={0} onSave={vi.fn()} formatter={fmt} aria-label="Budget" />);
    await user.dblClick(screen.getByText('$0.00'));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'abc');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Invalid number');
    // Input remains open
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('strips $ and commas when parsing', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<InlineNumberEdit value={0} onSave={onSave} formatter={fmt} aria-label="Budget" />);
    await user.dblClick(screen.getByText('$0.00'));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, '$1,500');
    await user.keyboard('{Enter}');
    expect(onSave).toHaveBeenCalledWith(1500);
  });

  it('has correct aria-label on pencil button', () => {
    render(<InlineNumberEdit value={0} onSave={vi.fn()} formatter={fmt} aria-label="Budget" />);
    expect(screen.getByRole('button', { name: 'Edit Budget' })).toBeInTheDocument();
  });
});
