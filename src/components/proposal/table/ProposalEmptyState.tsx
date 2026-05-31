import { Plus, Upload } from 'lucide-react';
import { Button } from '../../primitives';

type ProposalEmptyStateProps = {
  onImport?: (() => void) | undefined;
  onAddCategory: () => void;
  onDuplicate?: (() => void) | undefined;
};

export function ProposalEmptyState({
  onImport,
  onAddCategory,
  onDuplicate,
}: ProposalEmptyStateProps) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-lg border border-neutral-200 bg-canvas-chrome px-8 py-10 text-center shadow-sm">
        <div className="flex flex-col items-center gap-2">
          <h2 className="font-display text-2xl text-neutral-900">No categories yet</h2>
          <p className="text-sm text-neutral-600">
            Your client-facing price list — separate from the FF&amp;E catalog so quantities, costs,
            and totals don&apos;t clutter the design schedule.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onImport && (
              <Button type="button" variant="primary" size="md" onClick={onImport}>
                <Upload className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Import
              </Button>
            )}
            <Button type="button" variant="addAction" size="md" onClick={onAddCategory}>
              <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Add Category
            </Button>
          </div>
          {onDuplicate && (
            <button
              type="button"
              onClick={onDuplicate}
              className="text-link text-xs text-neutral-500 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              Or duplicate from another project
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
