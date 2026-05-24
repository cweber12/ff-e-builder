import { useMemo } from 'react';
import { useProposalRevisions, useRevisionChangelog, useRevisionSnapshots } from './useProposal';
import type { ProposalItemChangelogEntry, ProposalRevision, RevisionSnapshot } from '../../types';

export type RevisionInfoForItem = {
  openRev: ProposalRevision | null;
  revisions: ProposalRevision[];
  snapshot: RevisionSnapshot | undefined;
  changelog: ProposalItemChangelogEntry[];
};

/**
 * Selector hook that reads revision data for a single proposal item from the
 * shared React Query cache. Uses three focused hooks (same query keys as the
 * parent table) so no extra network requests are made.
 *
 * Designed to be used inside ProposalRowContent so each row owns its own
 * slice of revision state without receiving giant Map props from the parent.
 */
export function useRevisionInfoForItem(projectId: string, itemId: string): RevisionInfoForItem {
  const { data: revisions = [] } = useProposalRevisions(projectId);
  const { data: snapshots = [] } = useRevisionSnapshots(projectId);
  const { data: changelogAll = [] } = useRevisionChangelog(projectId);

  const openRev = useMemo(() => revisions.find((r) => r.closedAt === null) ?? null, [revisions]);

  const snapshot = useMemo((): RevisionSnapshot | undefined => {
    if (!openRev) return undefined;
    return snapshots.find((s) => s.revisionId === openRev.id && s.itemId === itemId);
  }, [openRev, snapshots, itemId]);

  const changelog = useMemo((): ProposalItemChangelogEntry[] => {
    if (!openRev) return [];
    return changelogAll.filter((e) => e.revisionId === openRev.id && e.proposalItemId === itemId);
  }, [openRev, changelogAll, itemId]);

  return { openRev, revisions, snapshot, changelog };
}
