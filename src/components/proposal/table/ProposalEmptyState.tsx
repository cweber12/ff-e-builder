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
                <UploadIcon />
                Import
              </Button>
            )}
            <Button
              type="button"
              variant={onImport ? 'secondary' : 'primary'}
              size="md"
              onClick={onAddCategory}
            >
              <PlusIcon />
              Add Category
            </Button>
          </div>
          {onDuplicate && (
            <button
              type="button"
              onClick={onDuplicate}
              className="text-xs text-neutral-500 underline-offset-2 hover:text-brand-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              Or duplicate from another project
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <path
        d="M7 1v8M4 4l3-3 3 3M2 11h10"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
