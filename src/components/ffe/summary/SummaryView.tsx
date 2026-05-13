import { lineTotalCents, projectTotalCents, roomSubtotalCents } from '../../../lib/money';
import { cents, formatMoney, itemStatuses, type Item, type Project } from '../../../types';
import type { RoomWithItems } from '../../../types';
import { StatusBadge } from '../../primitives';

type SummaryViewProps = {
  project: Project;
  roomsWithItems: RoomWithItems[];
};

export function SummaryView({ project, roomsWithItems }: SummaryViewProps) {
  const actualCents = projectTotalCents(roomsWithItems);
  const budgetPercent =
    project.budgetCents > 0 ? Math.min((actualCents / project.budgetCents) * 100, 100) : 0;
  const budgetTone =
    project.budgetCents > 0 && actualCents > project.budgetCents
      ? 'bg-danger-500'
      : budgetPercent >= 80
        ? 'bg-warning-500'
        : 'bg-success-500';
  const statusBreakdown = getStatusBreakdown(roomsWithItems.flatMap((room) => room.items));

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-950">Budget vs actual</h2>
            <p className="mt-1 text-sm text-gray-600">
              {formatMoney(cents(actualCents))} actual against{' '}
              {formatMoney(cents(project.budgetCents))} budget
            </p>
          </div>
          <span className="text-sm font-semibold tabular-nums text-gray-700">
            {project.budgetCents > 0
              ? `${Math.round((actualCents / project.budgetCents) * 100)}%`
              : 'No budget'}
          </span>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-pill bg-gray-100">
          <div
            className={`h-full rounded-pill ${budgetTone}`}
            style={{ width: `${budgetPercent}%` }}
          />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        {itemStatuses.map((status) => {
          const entry = statusBreakdown[status];
          return (
            <div key={status} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <StatusBadge status={status} />
              <p className="mt-4 text-2xl font-semibold text-gray-950">{entry.count}</p>
              <p className="mt-1 text-sm text-gray-600">{formatMoney(cents(entry.totalCents))}</p>
            </div>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Rooms</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3 text-right">Item count</th>
              <th className="px-4 py-3 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {roomsWithItems.map((room) => (
              <tr key={room.id}>
                <td className="px-4 py-3 font-medium text-gray-950">{room.name}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                  {room.items.length}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-950">
                  {formatMoney(cents(roomSubtotalCents(room.items)))}
                </td>
              </tr>
            ))}
            <tr className="bg-brand-50/50">
              <td className="px-4 py-3 font-semibold text-gray-950">Grand total</td>
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

function getStatusBreakdown(items: Item[]) {
  const base = Object.fromEntries(
    itemStatuses.map((status) => [status, { count: 0, totalCents: 0 }]),
  ) as Record<(typeof itemStatuses)[number], { count: number; totalCents: number }>;

  for (const item of items) {
    base[item.status].count += 1;
    base[item.status].totalCents += lineTotalCents(item.unitCostCents, item.qty);
  }

  return base;
}
