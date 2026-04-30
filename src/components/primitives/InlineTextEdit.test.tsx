import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InlineTextEdit } from './InlineTextEdit';

describe('InlineTextEdit', () => {
  it('renders display value initially', () => {
    render(<InlineTextEdit value="My project" onSave={vi.fn()} />);
    expect(screen.getByText('My project')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('enters edit mode on single click', async () => {
    const user = userEvent.setup();
    render(<InlineTextEdit value="My project" onSave={vi.fn()} />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('saves on Enter key', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<InlineTextEdit value="My project" onSave={onSave} />);
    await user.click(screen.getByRole('button'));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'New name');
    await user.keyboard('{Enter}');
    expect(onSave).toHaveBeenCalledWith('New name');
  });

  it('cancels on Escape key', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<InlineTextEdit value="My project" onSave={onSave} />);
    await user.click(screen.getByRole('button'));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'changed');
    await user.keyboard('{Escape}');
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('My project')).toBeInTheDocument();
  });

  it('saves on blur', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <div>
        <InlineTextEdit value="My project" onSave={onSave} />
        <button>elsewhere</button>
      </div>,
    );
    await user.click(screen.getByRole('button', { name: /edit/i }));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Saved on blur');
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(onSave).toHaveBeenCalledWith('Saved on blur');
  });

  it('shows error tooltip on save failure and keeps input open', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('Server error'));
    render(<InlineTextEdit value="Original" onSave={onSave} />);
    await user.click(screen.getByRole('button'));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'New value');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Server error');
    // Input still open with user's value
    expect(screen.getByRole('textbox')).toHaveValue('New value');
  });

  it('has aria-label on display element', () => {
    render(<InlineTextEdit value="Name" onSave={vi.fn()} aria-label="Project name" />);
    expect(screen.getByRole('button', { name: 'Project name' })).toBeInTheDocument();
  });
});
