import { useEffect, useState } from 'react';
import { Button } from '../primitives/Button';
import { Modal } from '../primitives/Modal';

type AddColumnModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (label: string) => Promise<void> | void;
};

export function AddColumnModal({ open, onClose, onSubmit }: AddColumnModalProps) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!open) setLabel('');
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Add custom column">
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = label.trim();
          if (!trimmed) return;
          void Promise.resolve(onSubmit(trimmed)).then(() => {
            setLabel('');
            onClose();
          });
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Column name
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal focus:border-brand-500 focus:outline-none"
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Add column</Button>
        </div>
      </form>
    </Modal>
  );
}
