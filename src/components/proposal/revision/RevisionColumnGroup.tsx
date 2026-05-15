import { cn } from '../../../lib/utils';
import type { ProposalRevision } from '../../../types';

const thBase =
  'h-10 border-y border-neutral-200 px-3 text-xs font-medium uppercase tracking-[0.08em] text-neutral-500 bg-surface whitespace-nowrap';

export function RevisionColumnGroup({ revision }: { revision: ProposalRevision }) {
  const l = revision.label;
  return (
    <>
      <th className={cn(thBase, 'w-20 min-w-[80px] border-l-2 border-l-brand-200')}>{l} Qty</th>
      <th className={cn(thBase, 'w-[112px] min-w-[112px]')}>{l} Cost</th>
      <th className={cn(thBase, 'w-24 min-w-[96px]')}>{l} Total</th>
    </>
  );
}
