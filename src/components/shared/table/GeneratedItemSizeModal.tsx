import type { SizeMode } from '../../../types';
import { DimensionEditorModal } from '../modals/DimensionEditorModal';

type GeneratedItemSizeInput = Partial<{
  mode: SizeMode;
  unit: string;
  w: string;
  d: string;
  h: string;
}>;

export type GeneratedItemSizeResult = {
  label: string;
  mode: SizeMode;
  unit: string;
  w: string;
  d: string;
  h: string;
};

type GeneratedItemSizeModalProps = {
  open: boolean;
  title?: string;
  initial?: GeneratedItemSizeInput;
  onClose: () => void;
  onSave: (result: GeneratedItemSizeResult) => void;
};

export function GeneratedItemSizeModal({
  open,
  title = 'Set size',
  initial,
  onClose,
  onSave,
}: GeneratedItemSizeModalProps) {
  return (
    <DimensionEditorModal
      open={open}
      title={title}
      {...(initial !== undefined ? { initial } : {})}
      onClose={onClose}
      onSave={onSave}
    />
  );
}
