import { Modal } from '../primitives';
import { ExportMenu } from '../shared/ExportMenu';
import { StatusBadge } from '../primitives';
import { lineTotalCents, projectTotalCents, roomSubtotalCents } from '../../lib/money';
import { exportSummaryCsv, exportSummaryExcel, exportSummaryPdf } from '../../lib/export';
import {
  cents,
  formatMoney,
  itemStatuses,
  type Item,
  type Project,
  type RoomWithItems,
} from '../../types';

type Props = {
  open: boolean;
  onClose: () => void;
  project: Project;
  roomsWithItems: RoomWithItems[];
};

export function FfeBudgetModal({ open, onClose, project, roomsWithItems }: Props) {
  const actualCents = projectTotalCents(roomsWithItems);
  const budgetCents =
    project.budgetMode === 'individual'
      ? (project.ffeBudgetCents ?? project.budgetCents)
      : project.budgetCents;
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
  const statusBreakdown = getStatusBreakdown(roomsWithItems.flatMap((r) => r.items));

  return (
    <Modal open={open} onClose={onClose} title="FF&E Budget" className="max-w-4xl">
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

          {/* Status grid */}
          <section className="grid gap-3 grid-cols-2 md:grid-cols-4">
            {itemStatuses.map((status) => {
              const entry = statusBreakdown[status];
              return (
                <div
                  key={status}
                  className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
                >
                  <StatusBadge status={status} />
                  <p className="mt-3 text-xl font-semibold text-gray-950">{entry.count}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {formatMoney(cents(entry.totalCents))}
                  </p>
                </div>
              );
            })}
          </section>

          {/* Rooms */}
          <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-4 py-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rooms</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">Room</th>
                  <th className="px-4 py-2 text-right">Items</th>
                  <th className="px-4 py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {roomsWithItems.map((room) => (
                  <tr key={room.id}>
                    <td className="px-4 py-2 font-medium text-gray-950">{room.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                      {room.items.length}
                    </td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums text-gray-950">
                      {formatMoney(cents(roomSubtotalCents(room.items)))}
                    </td>
                  </tr>
                ))}
                <tr className="bg-brand-50/50">
                  <td className="px-4 py-2 font-semibold text-gray-950">Total</td>
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
            onCsv={() => exportSummaryCsv(project, roomsWithItems)}
            onExcel={() => exportSummaryExcel(project, roomsWithItems)}
            onPdf={() => exportSummaryPdf(project, roomsWithItems)}
          />
        </div>
      </div>
    </Modal>
  );
}

function getStatusBreakdown(items: Item[]) {
  const base = Object.fromEntries(
    itemStatuses.map((s) => [s, { count: 0, totalCents: 0 }]),
  ) as Record<(typeof itemStatuses)[number], { count: number; totalCents: number }>;
  for (const item of items) {
    base[item.status].count += 1;
    base[item.status].totalCents += lineTotalCents(item.unitCostCents, item.qty);
  }
  return base;
}
