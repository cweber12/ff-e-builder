import { Modal } from '../primitives';
import { ExportMenu } from '../shared/ExportMenu';
import { proposalCategorySubtotalCents, proposalProjectTotalCents } from '../../lib/calc';
import { exportProposalCsv, exportProposalExcel, exportProposalPdf } from '../../lib/exportUtils';
import { cents, formatMoney, type Project, type ProposalCategoryWithItems } from '../../types';

type Props = {
  open: boolean;
  onClose: () => void;
  project: Project;
  categories: ProposalCategoryWithItems[];
};

export function ProposalBudgetModal({ open, onClose, project, categories }: Props) {
  const actualCents = proposalProjectTotalCents(categories);
  const budgetCents =
    project.budgetMode === 'individual' ? (project.proposalBudgetCents ?? 0) : project.budgetCents;
  const hasBudget = budgetCents > 0;
  const budgetPercent = hasBudget
    ? Math.min(Math.round((actualCents / budgetCents) * 100), 100)
    : 0;
  const budgetTone =
    hasBudget && actualCents > budgetCents
      ? 'bg-danger-500'
      : budgetPercent >= 80
        ? 'bg-warning-500'
        : 'bg-success-500';

  return (
    <Modal open={open} onClose={onClose} title="Proposal Budget" className="max-w-4xl">
      <div className="flex flex-col" style={{ maxHeight: 'calc(90vh - 9rem)' }}>
        <div className="flex-1 overflow-y-auto space-y-5 pb-4">
          {/* Budget vs actual */}
          <section className="rounded-lg border border-gray-200 bg-surface-muted p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-950">
                  {formatMoney(cents(actualCents))} actual
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {hasBudget
                    ? `against ${formatMoney(cents(budgetCents))} budget`
                    : 'No budget target set'}
                </p>
              </div>
              {hasBudget && (
                <span className="text-sm font-semibold tabular-nums text-gray-700">
                  {budgetPercent}%
                </span>
              )}
            </div>
            {hasBudget && (
              <div className="mt-3 h-2.5 overflow-hidden rounded-pill bg-gray-100">
                <div
                  className={`h-full rounded-pill ${budgetTone} transition-all`}
                  style={{ width: `${budgetPercent}%` }}
                />
              </div>
            )}
          </section>

          {/* Categories table */}
          <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-4 py-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Categories
              </h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2 text-right">Rows</th>
                  <th className="px-4 py-2 text-right">Quantity</th>
                  <th className="px-4 py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td className="px-4 py-2 font-medium text-gray-950">{category.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                      {category.items.length}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                      {category.items.reduce((sum, item) => sum + item.quantity, 0)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums text-gray-950">
                      {formatMoney(cents(proposalCategorySubtotalCents(category.items)))}
                    </td>
                  </tr>
                ))}
                <tr className="bg-brand-50/50">
                  <td className="px-4 py-2 font-semibold text-gray-950">Total</td>
                  <td className="px-4 py-2" />
                  <td className="px-4 py-2" />
                  <td className="px-4 py-2 text-right font-bold tabular-nums text-brand-700">
                    {formatMoney(cents(actualCents))}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-gray-100 pt-3">
          <ExportMenu
            label="Export"
            size="sm"
            onCsv={() => exportProposalCsv(project, categories)}
            onExcel={() => {
              void exportProposalExcel(project, categories);
            }}
            onPdf={() => {
              void exportProposalPdf(project, categories);
            }}
          />
        </div>
      </div>
    </Modal>
  );
}
