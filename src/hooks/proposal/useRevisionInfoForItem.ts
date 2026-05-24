import { useMemo } from 'react';
import { useProposalRevisions } from './useProposal';
import type { ProposalItemChangelogEntry, ProposalRevision, RevisionSnapshot } from '../../types';

export type RevisionInfoForItem = {
  openRev: ProposalRevision | null;
  revisions: ProposalRevision[];
  snapshot: RevisionSnapshot | undefined;
  changelog: ProposalItemChangelogEntry[];
};

/**
 * Selector hook that reads revision data for a single proposal item from the
 * shared React Query cache.  Calls useProposalRevisions (same query key as
 * ProposalCategorySection) so no extra network request is made.
 *
 * Designed to be used inside ProposalRowContent so each row owns its own
 * slice of revision state without receiving giant Map props from the parent.
 */
export function useRevisionInfoForItem(projectId: string, itemId: string): RevisionInfoForItem {
  const { data: revisionsData } = useProposalRevisions(projectId);

  const revisions = useMemo(
    () => revisionsData?.revisions ?? [],

    [revisionsData?.revisions],
  );

  const openRev = useMemo(() => revisions.find((r) => r.closedAt === null) ?? null, [revisions]);

  const snapshot = useMemo((): RevisionSnapshot | undefined => {
    if (!openRev || !revisionsData?.snapshots) return undefined;
    for (const s of revisionsData.snapshots) {
      if (s.revisionId === openRev.id && s.itemId === itemId) return s;
    }
    return undefined;
  }, [openRev, revisionsData?.snapshots, itemId]);

  const changelog = useMemo((): ProposalItemChangelogEntry[] => {
    if (!openRev || !revisionsData?.changelog) return [];
    return revisionsData.changelog.filter(
      (e) => e.revisionId === openRev.id && e.proposalItemId === itemId,
    );
  }, [openRev, revisionsData?.changelog, itemId]);

  return { openRev, revisions, snapshot, changelog };
}
