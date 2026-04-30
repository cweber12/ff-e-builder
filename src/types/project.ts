// ─── Branded money type ──────────────────────────────────────────────────────

/** Integer cents — prevents accidental dollar / cent mix-ups. */
export type Cents = number & { readonly __brand: 'Cents' };

export const cents = (n: number): Cents => n as Cents;

export const dollarsToCents = (d: number): Cents => Math.round(d * 100) as Cents;

export const formatMoney = (c: Cents): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(c / 100);

// ─── Entity type ─────────────────────────────────────────────────────────────

export type Project = {
  id: string;
  ownerUid: string;
  name: string;
  clientName: string;
  /** Always integer cents — see /docs/money.md */
  budgetCents: number;
  createdAt: string;
  updatedAt: string;
};
