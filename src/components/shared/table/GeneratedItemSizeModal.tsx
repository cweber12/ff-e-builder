import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import type { SizeMode } from '../../../types';
import { cn } from '../../../lib/utils';
import {
  DimensionEditorBody,
  DimensionEditorModal,
  type DimensionEditorInitial,
  type DimensionEditorResult,
} from '../modals/DimensionEditorModal';
import { EditablePencilHint } from './EditablePencilHint';

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

// ---------------------------------------------------------------------------
// Cell-anchored popover editor — replaces the previous trigger + modal pair.
// The Control owns its own open state; consumers pass current label + initial
// values and receive a save callback. The Cell wrapper adds <td> + pencil hint.
// ---------------------------------------------------------------------------

const POPOVER_WIDTH = 340;
const POPOVER_MAX_HEIGHT = 520;
const POPOVER_GAP = 6;

type GeneratedItemSizeControlProps = {
  value: string | null | undefined;
  initial?: DimensionEditorInitial;
  placeholder?: string;
  triggerVariant?: 'inline' | 'table';
  onSave: (result: DimensionEditorResult) => void;
};

export function GeneratedItemSizeControl({
  value,
  initial,
  placeholder = 'Set size',
  triggerVariant = 'table',
  onSave,
}: GeneratedItemSizeControlProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <div ref={triggerRef} className="inline-block">
        <GeneratedItemSizeTrigger
          value={value}
          placeholder={placeholder}
          variant={triggerVariant}
          onClick={() => setOpen(true)}
        />
      </div>
      {open && (
        <SizePopover anchorRef={triggerRef} onClose={() => setOpen(false)}>
          <DimensionEditorBody
            {...(initial !== undefined ? { initial } : {})}
            resetKey={open}
            onCancel={() => setOpen(false)}
            onSave={(result) => {
              onSave(result);
              setOpen(false);
            }}
          />
        </SizePopover>
      )}
    </>
  );
}

type GeneratedItemSizeCellProps = GeneratedItemSizeControlProps & {
  tdClassName?: string;
  indicator?: ReactNode;
};

export function GeneratedItemSizeCell({
  tdClassName,
  indicator,
  ...controlProps
}: GeneratedItemSizeCellProps) {
  return (
    <td
      className={cn('relative px-3 py-2', tdClassName)}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-1">
        <GeneratedItemSizeControl {...controlProps} />
        {indicator}
      </div>
      <EditablePencilHint />
    </td>
  );
}

type SizePopoverProps = {
  anchorRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  children: ReactNode;
};

function SizePopover({ anchorRef, onClose, children }: SizePopoverProps) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const wantBelow = rect.bottom + POPOVER_GAP + POPOVER_MAX_HEIGHT <= viewportHeight;
    const top = wantBelow
      ? rect.bottom + POPOVER_GAP
      : Math.max(8, rect.top - POPOVER_MAX_HEIGHT - POPOVER_GAP);
    const left = Math.min(Math.max(8, rect.left), Math.max(8, viewportWidth - POPOVER_WIDTH - 8));
    setCoords({ top, left });
  }, [anchorRef]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    const handleClick = (event: MouseEvent) => {
      if (!panelRef.current) return;
      if (panelRef.current.contains(event.target as Node)) return;
      if (anchorRef.current?.contains(event.target as Node)) return;
      onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [anchorRef, onClose]);

  if (!coords) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Set size"
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        width: POPOVER_WIDTH,
        maxHeight: POPOVER_MAX_HEIGHT,
      }}
      className="z-[100] overflow-auto rounded-md border border-black/10 bg-surface p-4 shadow-xl"
    >
      {children}
    </div>,
    document.body,
  );
}
