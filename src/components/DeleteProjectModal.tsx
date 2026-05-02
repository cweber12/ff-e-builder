import { Button } from './primitives/Button';
import { Modal } from './primitives/Modal';
import type { Project } from '../types';

type DeleteProjectModalProps = {
  project: Project | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
};

export function DeleteProjectModal({ project, onClose, onConfirm }: DeleteProjectModalProps) {
  if (!project) return null;
  return (
    <Modal open onClose={onClose} title="Delete project">
      <div className="flex flex-col gap-5">
        <p className="text-sm text-gray-600">
          Permanently delete <strong className="font-semibold text-gray-950">{project.name}</strong>
          ? All rooms and items will be removed. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              onConfirm(project.id);
              onClose();
            }}
          >
            Delete project
          </Button>
        </div>
      </div>
    </Modal>
  );
}
