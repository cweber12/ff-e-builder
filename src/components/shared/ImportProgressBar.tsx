import { formatDuration, type ImportProgress } from '../../lib/import';

export function ImportProgressBar({
  progress,
  nowMs,
  label = 'Import progress',
}: {
  progress: ImportProgress;
  nowMs: number;
  label?: string;
}) {
  const ratio = progress.total > 0 ? Math.min(1, progress.processed / progress.total) : 0;
  const percent = Math.round(ratio * 100);
  const elapsedMs = progress.startedAt ? Math.max(0, nowMs - progress.startedAt) : 0;
  const remainingSteps = Math.max(0, progress.total - progress.processed);
  const remainingMs =
    progress.processed > 0
      ? Math.round((elapsedMs / progress.processed) * remainingSteps)
      : undefined;

  return (
    <div className="rounded-lg border border-gray-200 bg-surface-muted p-3">
      <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
        <span>
          Import progress: {progress.processed} of {progress.total}
        </span>
        <span>
          {percent}%
          {remainingMs !== undefined ? ` • ~${formatDuration(remainingMs)} remaining` : ''}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-brand-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.processed}
        />
      </div>
    </div>
  );
}
