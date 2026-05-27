import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function SlotPortal({ slotId, children }: { slotId: string; children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSlot(document.getElementById(slotId));
  }, [slotId]);

  if (!slot) return null;

  return createPortal(children, slot);
}
