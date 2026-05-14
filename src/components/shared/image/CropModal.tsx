import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { Button, Modal } from '../../primitives';
import type { CropParams } from '../../../types';

type CropModalProps = {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  aspect: number;
  onSave: (params: CropParams) => void;
  isSaving?: boolean;
};

export function CropModal({
  open,
  onClose,
  imageUrl,
  aspect,
  onSave,
  isSaving = false,
}: CropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pendingParams, setPendingParams] = useState<CropParams | null>(null);

  // Bail out when x/y are unchanged. react-easy-crop fires onCropChange with a new object
  // reference every cycle even when the position hasn't moved — that new reference triggers
  // componentDidUpdate → recomputeCropPosition → onCropChange → setCrop → re-render → loop.
  const handleCropChange = useCallback(
    (newCrop: { x: number; y: number }) =>
      setCrop((prev) => (prev.x === newCrop.x && prev.y === newCrop.y ? prev : newCrop)),
    [],
  );

  const handleCropComplete = useCallback((croppedArea: Area) => {
    setPendingParams({
      cropX: croppedArea.x / 100,
      cropY: croppedArea.y / 100,
      cropWidth: croppedArea.width / 100,
      cropHeight: croppedArea.height / 100,
    });
  }, []);

  const handleSave = () => {
    if (pendingParams) onSave(pendingParams);
  };

  return (
    <Modal open={open} onClose={onClose} title="Crop image" className="max-w-2xl">
      <div className="flex flex-col gap-4">
        <div className="relative h-80 w-full overflow-hidden rounded-lg bg-gray-900">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={handleCropChange}
            onZoomChange={setZoom}
            onCropComplete={(croppedArea) => handleCropComplete(croppedArea)}
            objectFit="contain"
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-600 shrink-0">Zoom</label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-brand-600"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !pendingParams}
          >
            {isSaving ? 'Saving…' : 'Save crop'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
