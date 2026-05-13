import type { ProposalStatus } from '../../types';

export const proposalStatusConfig: Record<
  ProposalStatus,
  { label: string; bgClass: string; textClass: string; hoverClass: string; dotClass: string }
> = {
  in_progress: {
    label: 'In Progress',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-700',
    hoverClass: 'hover:bg-blue-100',
    dotClass: 'bg-blue-400',
  },
  pricing_complete: {
    label: 'Pricing Complete',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
    hoverClass: 'hover:bg-amber-100',
    dotClass: 'bg-amber-400',
  },
  submitted: {
    label: 'Submitted',
    bgClass: 'bg-purple-50',
    textClass: 'text-purple-700',
    hoverClass: 'hover:bg-purple-100',
    dotClass: 'bg-purple-400',
  },
  approved: {
    label: 'Approved',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
    hoverClass: 'hover:bg-emerald-100',
    dotClass: 'bg-emerald-400',
  },
};
