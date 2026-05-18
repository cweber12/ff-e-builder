import { useMemo, type ReactNode } from 'react';
import { useProposalItemChangelog } from '../../../hooks';
import type { ProposalItemChangelogEntry, ProposalRevision } from '../../../types';
import { RevisionHistoryDot } from './RevisionHistoryDot';

type GeneratedItemRevisionIndicatorProps = {
  entries: ProposalItemChangelogEntry[];
  revisions: ProposalRevision[];
  title?: string;
  triggerTitle?: string;
  footer?: ReactNode;
  requireGeneratedItemId?: boolean;
};

type GeneratedItemRevisionIndicatorWrapProps = GeneratedItemRevisionIndicatorProps & {
  children: ReactNode;
};

export function GeneratedItemRevisionIndicator({
  entries,
  revisions,
  title,
  triggerTitle,
  footer,
  requireGeneratedItemId = true,
}: GeneratedItemRevisionIndicatorProps) {
  return (
    <RevisionHistoryDot
      entries={entries}
      revisions={revisions}
      {...(title !== undefined ? { title } : {})}
      {...(triggerTitle !== undefined ? { triggerTitle } : {})}
      {...(footer !== undefined ? { footer } : {})}
      requireGeneratedItemId={requireGeneratedItemId}
    />
  );
}

export function GeneratedItemRevisionIndicatorWrap({
  children,
  entries,
  revisions,
  title,
  triggerTitle,
  footer,
  requireGeneratedItemId,
}: GeneratedItemRevisionIndicatorWrapProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {children}
      <GeneratedItemRevisionIndicator
        entries={entries}
        revisions={revisions}
        {...(title !== undefined ? { title } : {})}
        {...(triggerTitle !== undefined ? { triggerTitle } : {})}
        {...(footer !== undefined ? { footer } : {})}
        {...(requireGeneratedItemId !== undefined ? { requireGeneratedItemId } : {})}
      />
    </span>
  );
}

export function GeneratedItemProposalImpactIndicatorWrap({
  children,
  entries,
  revisions,
}: {
  children: ReactNode;
  entries: ProposalItemChangelogEntry[];
  revisions: ProposalRevision[];
}) {
  return (
    <GeneratedItemRevisionIndicatorWrap
      entries={entries}
      revisions={revisions}
      title="Proposal revision history"
      triggerTitle="View Proposal revision history"
      footer={
        <span className="text-[11px] text-neutral-500">
          Cost resolution is handled in Proposal.
        </span>
      }
      requireGeneratedItemId
    >
      {children}
    </GeneratedItemRevisionIndicatorWrap>
  );
}

export function GeneratedItemColumnChangeDot({
  itemId,
  columnKey,
  revisions,
}: {
  itemId: string;
  columnKey: string;
  revisions: ProposalRevision[];
}) {
  const { data: changelog = [] } = useProposalItemChangelog(itemId);

  const entries = useMemo(
    () => changelog.filter((entry) => entry.columnKey === columnKey),
    [changelog, columnKey],
  );

  return <GeneratedItemRevisionIndicator entries={entries} revisions={revisions} />;
}
