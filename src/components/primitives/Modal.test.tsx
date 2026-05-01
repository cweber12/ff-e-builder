import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

describe('Modal', () => {
  it('does not render content when closed', () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Test modal">
        <p>Content here</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title and children when open', () => {
    render(
      <Modal open={true} onClose={vi.fn()} title="Create project">
        <p>Modal body</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Create project')).toBeInTheDocument();
    expect(screen.getByText('Modal body')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Modal">
        <p>body</p>
      </Modal>,
    );
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Modal">
        <button>inner button</button>
      </Modal>,
    );
    screen.getByRole('button', { name: 'inner button' }).focus();
    await user.keyboard('{Escape}');
    // The native dialog fires 'close' event on Escape — our useEffect calls onClose
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('has aria-labelledby pointing to title', () => {
    render(
      <Modal open={true} onClose={vi.fn()} title="Accessible modal">
        <p>body</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    const titleId = dialog.getAttribute('aria-labelledby');
    expect(titleId).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Accessible modal' })).toHaveAttribute(
      'id',
      titleId,
    );
  });
});
