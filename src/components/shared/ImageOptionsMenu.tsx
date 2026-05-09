import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';

type ImageOptionsMenuProps = {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  onUpdate?: () => void;
  onCrop?: () => void;
  onDelete?: () => void;
  canUpdate?: boolean;
  canCrop?: boolean;
  canDelete?: boolean;
};

export function ImageOptionsMenu({
  anchorRef,
  open,
  onClose,
  onUpdate,
  onCrop,
  onDelete,
  canUpdate = false,
  canCrop = false,
  canDelete = false,
}: ImageOptionsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      left: rect.left,
    });
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open, onClose, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const btnBase =
    'flex w-full items-center rounded px-2 py-1.5 text-left text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500';

  return createPortal(
    <div
      ref={menuRef}
      style={{ top: pos.top, left: pos.left }}
      className="fixed z-50 min-w-28 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
    >
      {canUpdate && (
        <button
          type="button"
          className={cn(btnBase, 'text-gray-700 hover:bg-brand-50')}
          onClick={() => {
            onUpdate?.();
            onClose();
          }}
        >
          Update
        </button>
      )}
      {canCrop && (
        <button
          type="button"
          className={cn(btnBase, 'text-gray-700 hover:bg-brand-50')}
          onClick={() => {
            onCrop?.();
            onClose();
          }}
        >
          Crop
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          className={cn(
            btnBase,
            'text-danger-600 hover:bg-red-50 focus-visible:outline-danger-500',
          )}
          onClick={() => {
            onDelete?.();
            onClose();
          }}
        >
          Remove
        </button>
      )}
    </div>,
    document.body,
  );
}
