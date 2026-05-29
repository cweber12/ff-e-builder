import { Button, Modal } from '../../../primitives';

type DeleteItemModalProps = {
  open: boolean;
  itemName: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteItemModal({ open, itemName, onClose, onConfirm }: DeleteItemModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={`Delete ${itemName}?`}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-neutral-600">
          This will permanently remove <strong>{itemName}</strong> from the proposal. This cannot be
          undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm}>
            Delete item
          </Button>
        </div>
      </div>
    </Modal>
  );
}
