import { proposalCategorySubtotalCents, proposalProjectTotalCents } from '../../../lib/money';
import { cents, formatMoney, type Project, type ProposalCategoryWithItems } from '../../../types';

type ProposalSummaryViewProps = {
  project: Project;
  categories: ProposalCategoryWithItems[];
};

export function ProposalSummaryView({ project, categories }: ProposalSummaryViewProps) {
  const actualCents = proposalProjectTotalCents(categories);
  const budgetCents =
    project.budgetMode === 'individual' ? (project.proposalBudgetCents ?? 0) : project.budgetCents;
  const budgetPercent =
    budgetCents > 0 ? Math.min(Math.round((actualCents / budgetCents) * 100), 100) : 0;
  const budgetTone =
    budgetCents > 0 && actualCents > budgetCents
      ? 'bg-danger-500'
      : budgetPercent >= 80
        ? 'bg-warning-500'
        : 'bg-success-500';

  return (
    <div className="space-y-10">
      <section>
        <p className="eyebrow">Proposal · Budget vs Actual</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200 pb-4">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight text-neutral-950">
              {formatMoney(cents(actualCents))}
              <span className="ml-2 text-base font-medium text-neutral-500">
                of {formatMoney(cents(budgetCents))}
              </span>
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              {budgetCents > 0 && actualCents > budgetCents
                ? 'Over budget'
                : budgetCents === 0
                  ? 'No budget set'
                  : 'Within budget'}
            </p>
          </div>
          <span className="num text-2xl font-semibold tracking-tight text-neutral-950">
            {budgetCents > 0 ? `${budgetPercent}%` : '—'}
          </span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden bg-canvas-shell">
          <div className={`h-full ${budgetTone}`} style={{ width: `${budgetPercent}%` }} />
        </div>
      </section>

      <section className="bg-paper border-y border-neutral-200">
        <div className="border-b border-neutral-200 px-5 py-3">
          <h2 className="eyebrow">Categories</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-600">
            <tr>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3 text-right">Rows</th>
              <th className="px-5 py-3 text-right">Quantity</th>
              <th className="px-5 py-3 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/10">
            {categories.map((category) => (
              <tr key={category.id}>
                <td className="px-5 py-3 font-medium text-neutral-950">{category.name}</td>
                <td className="num px-5 py-3 text-right text-neutral-700">
                  {category.items.length}
                </td>
                <td className="num px-5 py-3 text-right text-neutral-700">
                  {category.items.reduce((sum, item) => sum + item.quantity, 0)}
                </td>
                <td className="num px-5 py-3 text-right font-medium text-neutral-950">
                  {formatMoney(cents(proposalCategorySubtotalCents(category.items)))}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-brand-700/40 bg-brand-50/50">
              <td className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
                Grand total
              </td>
              <td className="px-5 py-4" />
              <td className="px-5 py-4" />
              <td className="num px-5 py-4 text-right text-lg font-semibold tracking-tight text-brand-700">
                {formatMoney(cents(actualCents))}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
