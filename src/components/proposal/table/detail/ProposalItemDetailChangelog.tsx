import { useEffect, useState } from 'react';
import type { ProposalItemChangelogEntry } from '../../../../types';
import { useUpdateChangelogEntryNotes } from '../../../../hooks';
import { Badge } from '../../../primitives';

type ProposalItemDetailChangelogProps = {
  revisionLabel: string;
  entries: ProposalItemChangelogEntry[];
  projectId: string;
};

export function ProposalItemDetailChangelog({
  revisionLabel,
  entries,
  projectId,
}: ProposalItemDetailChangelogProps) {
  return (
    <section className="mt-7 border-t border-neutral-200 pt-5">
      <div className="mb-3 flex items-baseline gap-2">
        <p className="eyebrow">Changes this revision</p>
        <Badge
          variant="brand"
          size="md"
          className="bg-brand-500/15 text-[11px] ring-0 ring-transparent"
        >
          Revision {revisionLabel}
        </Badge>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No tracked changes to this item in the current revision yet.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {entries.map((entry) => (
            <ChangelogEntryRow key={entry.id} entry={entry} projectId={projectId} />
          ))}
        </ol>
      )}
    </section>
  );
}

function ChangelogEntryRow({
  entry,
  projectId,
}: {
  entry: ProposalItemChangelogEntry;
  projectId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.notes ?? '');
  const updateNotes = useUpdateChangelogEntryNotes(projectId);

  useEffect(() => {
    if (!editing) setDraft(entry.notes ?? '');
  }, [entry.notes, editing]);

  async function handleSave() {
    const trimmed = draft.trim();
    await updateNotes.mutateAsync({ entryId: entry.id, notes: trimmed || null });
    setEditing(false);
  }

  function handleCancel() {
    setDraft(entry.notes ?? '');
    setEditing(false);
  }

  const previous = entry.previousValue || '—';
  const next = entry.newValue || '—';
  const when = new Date(entry.changedAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <li className="rounded-sm border border-neutral-200 bg-canvas-shell px-3 py-2 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-neutral-800">{entry.columnKey}</span>
        <span className="text-[11px] tabular-nums text-neutral-500">{when}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2 text-neutral-700">
        <span className="text-neutral-500 line-through">{previous}</span>
        <span aria-hidden="true">→</span>
        <span className="font-medium">{next}</span>
        {entry.isPriceAffecting && (
          <span className="ml-auto rounded-pill bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            Price
          </span>
        )}
      </div>
      {editing ? (
        <div className="mt-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
            placeholder="Add a note…"
            autoFocus
            className="w-full rounded border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="mt-1 flex gap-3">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={updateNotes.isPending}
              className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
            >
              {updateNotes.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs text-neutral-500 hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : entry.notes ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="group mt-1.5 block w-full text-left text-sm text-neutral-600 hover:text-neutral-800"
        >
          {entry.notes}
          <span className="ml-1 hidden text-[11px] text-neutral-400 group-hover:inline">edit</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-1.5 text-xs text-neutral-400 hover:text-brand-600 hover:underline"
        >
          + Add notes
        </button>
      )}
    </li>
  );
}
