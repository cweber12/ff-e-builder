import { z } from 'zod';

export const proposalStatuses = [
  'in_progress',
  'pricing_complete',
  'submitted',
  'approved',
] as const;

export const ProposalStatusSchema = z.enum(proposalStatuses);
export type ProposalStatus = z.infer<typeof ProposalStatusSchema>;
