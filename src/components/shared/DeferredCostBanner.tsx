import { useState } from 'react';
import { Button } from '../primitives';

interface DeferredCostBannerProps {
  deferredCount: number;
  onReview?: () => void;
}

export function DeferredCostBanner({ deferredCount, onReview }: DeferredCostBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || deferredCount === 0) return null;

  return (
    <div className="flex h-7 shrink-0 items-center border-y border-warning-500/30 bg-warning-500/8 px-4">
      <span className="text-xs text-neutral-700">
        {deferredCount} {deferredCount === 1 ? 'item has' : 'items have'} deferred cost updates
      </span>
      <div className="ml-auto flex items-center gap-3">
        {onReview && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReview}
            className="h-auto px-0 text-xs font-medium hover:bg-transparent hover:underline"
          >
            Review
          </Button>
        )}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-xs text-neutral-500 hover:text-neutral-700"
          aria-label="Dismiss deferred cost banner"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
