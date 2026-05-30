import type { ReactNode } from 'react';
import { Button, Modal } from '../../primitives';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  /** Body copy explaining the consequence of confirming. */
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true, the confirm action is styled as destructive. */
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Lightweight yes/no confirmation built on the shared Modal primitive. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} className="max-w-md">
      <div className="space-y-5">
        <div className="text-sm leading-6 text-neutral-600">{message}</div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <>Working&hellip;</> : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
