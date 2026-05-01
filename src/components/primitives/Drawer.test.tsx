import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Drawer } from './Drawer';

describe('Drawer', () => {
  it('panel is off-screen when closed', () => {
    render(
      <Drawer open={false} onClose={vi.fn()} title="Item details">
        <p>body</p>
      </Drawer>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('panel is visible when open', () => {
    render(
      <Drawer open={true} onClose={vi.fn()} title="Item details">
        <p>Drawer content</p>
      </Drawer>,
    );
    const panel = screen.getByRole('dialog');
    expect(panel.className).toContain('translate-x-0');
    expect(screen.getByText('Drawer content')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Drawer open={true} onClose={onClose} title="Drawer">
        <p>body</p>
      </Drawer>,
    );
    await user.click(screen.getByRole('button', { name: 'Close drawer' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Drawer open={true} onClose={onClose} title="Drawer">
        <button>focus target</button>
      </Drawer>,
    );
    screen.getByRole('button', { name: 'focus target' }).focus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('focus trap keeps focus within panel', async () => {
    const user = userEvent.setup();
    render(
      <Drawer open={true} onClose={vi.fn()} title="Drawer">
        <button>first</button>
        <button>second</button>
      </Drawer>,
    );

    // Focus the close button (first focusable), then Tab through until wrap
    const closeBtn = screen.getByRole('button', { name: 'Close drawer' });
    closeBtn.focus();

    // Tab forward through: close → first → second → wraps to close
    await user.tab();
    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'second' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Close drawer' })).toHaveFocus();
  });

  it('has correct ARIA attributes', () => {
    render(
      <Drawer open={true} onClose={vi.fn()} title="Accessible drawer">
        <p>body</p>
      </Drawer>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const titleId = dialog.getAttribute('aria-labelledby');
    expect(titleId).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Accessible drawer' })).toHaveAttribute(
      'id',
      titleId,
    );
  });
});
