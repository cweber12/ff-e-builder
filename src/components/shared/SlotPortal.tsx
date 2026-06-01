import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function SlotPortal({ slotId, children }: { slotId: string; children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const updateSlot = () => {
      const nextSlot = document.getElementById(slotId);
      setSlot((currentSlot) => (currentSlot === nextSlot ? currentSlot : nextSlot));
    };

    updateSlot();

    const observer = new MutationObserver(updateSlot);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [slotId]);

  if (!slot) return null;

  return createPortal(children, slot);
}
