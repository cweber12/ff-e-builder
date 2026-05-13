import { ApiError } from '../api';

export type ImportProgress = {
  processed: number;
  total: number;
  startedAt: number | null;
};

export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

export function describeImportError(err: unknown): string {
  if (err instanceof ApiError && err.message.trim().length > 0) return err.message;
  if (err instanceof Error && err.message.trim().length > 0) return err.message;
  return 'Upload failed';
}
