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
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-[14px] border border-neutral-200 bg-white px-8 py-10 text-center shadow-sm">
        <div className="flex flex-col items-center gap-2">
          <p className="eyebrow text-brand-700">Item Library</p>
          <h2 className="text-xl font-semibold text-neutral-900">No schedules yet</h2>
          <p className="text-sm text-neutral-600">
            Add the first schedule to organize items, plans, materials, and pricing without the
            spreadsheet noise.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onImport && (
              <Button type="button" variant="primary" size="md" onClick={onImport}>
                <Upload className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Upload
              </Button>
            )}
            <Button type="button" variant="addAction" size="md" onClick={onAddCategory}>
              <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Add Schedule
            </Button>
          </div>
          {onDuplicate && (
            <button
              type="button"
              onClick={onDuplicate}
              className="text-link text-xs text-neutral-500 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              Duplicate from another project
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
