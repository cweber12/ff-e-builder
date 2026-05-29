import type { Finish } from '../../types';
import { Button, Modal } from '../primitives';

export function FinishCollisionPrompt({
  existingFinish: _existingFinish,
  draftName,
  onUseExisting,
  onOverwrite,
  onCancel,
}: {
  existingFinish: Finish;
  draftName: string;
  onUseExisting: () => void;
  onOverwrite: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open title="Finish name conflict" onClose={onCancel}>
      <div className="grid gap-4">
        <p className="text-sm text-neutral-700">
          A finish named <strong className="font-semibold text-neutral-950">"{draftName}"</strong>{' '}
          already exists in this project. What would you like to do?
        </p>
        <p className="text-xs text-neutral-500">
          Overwrite updates the swatch image only — existing metadata is not changed.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="secondary" onClick={onUseExisting}>
            Use existing
          </Button>
          <Button type="button" onClick={onOverwrite}>
            Overwrite swatch
          </Button>
        </div>
      </div>
    </Modal>
  );
}
