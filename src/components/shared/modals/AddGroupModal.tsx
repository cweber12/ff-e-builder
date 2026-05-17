import { useEffect, useState } from 'react';
import { Button } from '../../primitives/Button';
import { Modal } from '../../primitives/Modal';

type AddGroupModalProps = {
  open: boolean;
  groupLabel: 'Location' | 'Room' | 'Category';
  onClose: () => void;
  onSubmit: (name: string) => Promise<void> | void;
};

export function AddGroupModal({ open, groupLabel, onClose, onSubmit }: AddGroupModalProps) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (!open) setName('');
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title={`Add ${groupLabel}`}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          void Promise.resolve(onSubmit(trimmed)).then(() => {
            setName('');
            onClose();
          });
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          {groupLabel} name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal focus:border-brand-500 focus:outline-none"
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Add {groupLabel.toLowerCase()}</Button>
        </div>
      </form>
    </Modal>
  );
}
