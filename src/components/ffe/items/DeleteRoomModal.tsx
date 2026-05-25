import { Button } from '../../primitives/Button';
import { Modal } from '../../primitives/Modal';
import type { RoomWithItems } from '../../../types';

type DeleteRoomModalProps = {
  room: RoomWithItems | null;
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
};

export function DeleteRoomModal({ room, open, onClose, onConfirm }: DeleteRoomModalProps) {
  const itemCount = room?.items.length ?? 0;
  const hasItems = itemCount > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={room ? `Remove ${room.name} from FF&E?` : 'Remove location from FF&E'}
    >
      <div className="flex flex-col gap-4">
        {hasItems ? (
          <p className="text-sm text-neutral-600">
            <strong>{room?.name}</strong> has {itemCount} {itemCount === 1 ? 'item' : 'items'}. This
            removes the location and its items from the FF&amp;E table only. They stay in the
            Project database and Proposal table.
          </p>
        ) : (
          <p className="text-sm text-neutral-600">
            This removes the empty location from the FF&amp;E table without deleting the database
            row.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              void Promise.resolve(onConfirm()).then(() => {
                onClose();
              });
            }}
          >
            Remove from FF&amp;E
          </Button>
        </div>
      </div>
    </Modal>
  );
}
