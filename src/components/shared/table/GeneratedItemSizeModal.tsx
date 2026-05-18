import type { SizeMode } from '../../../types';
import { cn } from '../../../lib/utils';
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

type GeneratedItemSizeTriggerProps = {
  value: string | null | undefined;
  placeholder: string;
  onClick: () => void;
  variant?: 'inline' | 'table';
};

export function GeneratedItemSizeTrigger({
  value,
  placeholder,
  onClick,
  variant = 'table',
}: GeneratedItemSizeTriggerProps) {
  const displayValue = value?.trim() ?? '';
  const hasValue = displayValue.length > 0;

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-md px-1 py-0.5 text-left text-sm text-neutral-700 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        {hasValue ? displayValue : <span className="text-neutral-400">{placeholder}</span>}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-h-9 w-40 rounded text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
        hasValue
          ? 'px-2 py-1 text-neutral-700 hover:bg-brand-50'
          : 'border border-neutral-300 px-2 py-1 text-neutral-400 hover:border-brand-500',
      )}
    >
      {hasValue ? displayValue : placeholder}
    </button>
  );
}
