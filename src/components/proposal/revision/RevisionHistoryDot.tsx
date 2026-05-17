import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../../lib/utils';
import type { ProposalItemChangelogEntry, ProposalRevision } from '../../../types';
import { proposalStatusConfig } from '../proposalStatusConfig';

type RevisionHistoryDotProps = {
  entries: ProposalItemChangelogEntry[];
  revisions: ProposalRevision[];
  title?: string;
  triggerTitle?: string;
  footer?: ReactNode;
  requireGeneratedItemId?: boolean;
};

function formatRevisionDate(isoString: string): string {
  const date = new Date(isoString);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function RevisionHistoryDot({
  entries,
  revisions,
  title = 'Change history',
  triggerTitle = 'View change history',
  footer,
  requireGeneratedItemId = false,
}: RevisionHistoryDotProps) {
  const revisionLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const revision of revisions) map.set(revision.id, revision.label);
    return map;
  }, [revisions]);

  const visibleEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.revisionId !== null &&
          revisionLabelMap.has(entry.revisionId) &&
          (!requireGeneratedItemId || entry.generatedItemId !== null),
      ),
    [entries, requireGeneratedItemId, revisionLabelMap],
  );

  const groupedEntries = useMemo(() => {
    const groups: { label: string; entries: ProposalItemChangelogEntry[] }[] = [];
    const seen = new Map<string, { label: string; entries: ProposalItemChangelogEntry[] }>();
    for (const entry of visibleEntries) {
      const key = entry.revisionId!;
      const label = revisionLabelMap.get(key) ?? 'Unknown';
      if (!seen.has(key)) {
        const group = { label, entries: [] };
        groups.push(group);
        seen.set(key, group);
      }
      seen.get(key)!.entries.push(entry);
    }
    return groups;
  }, [revisionLabelMap, visibleEntries]);

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: globalThis.MouseEvent) => {
      const inTrigger = triggerRef.current?.contains(event.target as Node) ?? false;
      const inPopup = popupRef.current?.contains(event.target as Node) ?? false;
      if (!inTrigger && !inPopup) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (visibleEntries.length === 0) return null;

  const latest = visibleEntries.reduce((latestEntry, entry) =>
    entry.changedAt > latestEntry.changedAt ? entry : latestEntry,
  );
  const cfg = proposalStatusConfig[latest.proposalStatus];
  const triggerRect = triggerRef.current?.getBoundingClientRect();

  return (
    <span className="inline-flex">
      <button
        ref={triggerRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        title={triggerTitle}
        className={cn('h-2 w-2 flex-shrink-0 rounded-full', cfg.dotClass)}
      />
      {open &&
        triggerRect &&
        createPortal(
          <div
            ref={popupRef}
            style={{
              position: 'fixed',
              top: triggerRect.bottom + 4,
              left: triggerRect.left,
            }}
            className="z-[100] min-w-56 max-w-xs rounded-lg border border-gray-200 bg-white shadow-lg"
          >
            <div className="border-b border-gray-100 px-3 py-2 text-xs font-semibold text-gray-600">
              {title}
            </div>
            <ul className="max-h-56 overflow-y-auto">
              {groupedEntries.map((group) => (
                <Fragment key={group.label}>
                  <li className="sticky top-0 border-b border-gray-100 bg-gray-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    {group.label === 'General' ? 'General' : `Round ${group.label}`}
                  </li>
                  {group.entries.map((entry) => (
                    <li key={entry.id} className="divide-y divide-gray-50 px-3 py-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'h-1.5 w-1.5 flex-shrink-0 rounded-full',
                            proposalStatusConfig[entry.proposalStatus].dotClass,
                          )}
                        />
                        <span className="text-gray-400">{formatRevisionDate(entry.changedAt)}</span>
                      </div>
                      <div className="mt-0.5 flex items-baseline gap-1">
                        <span className="text-gray-400 line-through">
                          {entry.previousValue || '-'}
                        </span>
                        <span className="text-gray-300">-&gt;</span>
                        <span className="font-medium text-gray-700">{entry.newValue || '-'}</span>
                      </div>
                      {entry.notes && <p className="mt-0.5 italic text-gray-500">{entry.notes}</p>}
                    </li>
                  ))}
                </Fragment>
              ))}
            </ul>
            {footer && <div className="border-t border-gray-100 px-3 py-2">{footer}</div>}
          </div>,
          document.body,
        )}
    </span>
  );
}
