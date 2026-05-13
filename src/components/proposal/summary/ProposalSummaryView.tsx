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
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-950">Proposal budget vs actual</h2>
            <p className="mt-1 text-sm text-gray-600">
              {formatMoney(cents(actualCents))} actual against {formatMoney(cents(budgetCents))}{' '}
              budget
            </p>
          </div>
          <span className="text-sm font-semibold tabular-nums text-gray-700">
            {budgetCents > 0 ? `${budgetPercent}%` : 'No budget'}
          </span>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-pill bg-gray-100">
          <div
            className={`h-full rounded-pill ${budgetTone}`}
            style={{ width: `${budgetPercent}%` }}
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
            Categories
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Rows</th>
              <th className="px-4 py-3 text-right">Quantity</th>
              <th className="px-4 py-3 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categories.map((category) => (
              <tr key={category.id}>
                <td className="px-4 py-3 font-medium text-gray-950">{category.name}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                  {category.items.length}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                  {category.items.reduce((sum, item) => sum + item.quantity, 0)}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-950">
                  {formatMoney(cents(proposalCategorySubtotalCents(category.items)))}
                </td>
              </tr>
            ))}
            <tr className="bg-brand-50/50">
              <td className="px-4 py-3 font-semibold text-gray-950">Grand total</td>
              <td className="px-4 py-3" />
              <td className="px-4 py-3" />
              <td className="px-4 py-3 text-right font-bold tabular-nums text-brand-700">
                {formatMoney(cents(actualCents))}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
