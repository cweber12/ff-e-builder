import type { ProposalItemChangelogEntry } from '../../../types';

interface RevisionNotesCellProps {
  /** Changelog entries for this item in the current open revision. */
  entries: ProposalItemChangelogEntry[];
}

/**
 * Displays all non-empty revision notes for an item in a single cell,
 * one line per note. Renders a dash when there are no notes to show.
 */
export function RevisionNotesCell({ entries }: RevisionNotesCellProps) {
  const notes = entries.map((e) => e.notes).filter((n): n is string => Boolean(n));

  if (notes.length === 0) {
    return (
      <td className="px-2 py-1.5 text-sm text-muted-foreground text-center min-w-[160px]">—</td>
    );
  }

  return (
    <td className="px-2 py-1.5 text-sm min-w-[160px] align-top">
      <div className="space-y-0.5">
        {notes.map((note, i) => (
          <p key={i} className="leading-snug whitespace-pre-wrap">
            {note}
          </p>
        ))}
      </div>
    </td>
  );
}
