import type { ItemStatus } from '../types';

// ─── Static sample data (mirrors sampleProject.ts seeds, no API calls) ────

const DEMO_ROOMS: Array<{
  name: string;
  items: Array<{
    itemIdTag: string;
    itemName: string;
    category: string;
    vendor: string;
    model: string;
    dimensions: string;
    qty: number;
    unitCostCents: number;
    markupPct: number;
    status: ItemStatus;
    materialNames: string[];
  }>;
}> = [
  {
    name: 'Lobby',
    items: [
      {
        itemIdTag: 'LB-001',
        itemName: 'Reception Desk',
        category: 'Millwork',
        vendor: 'Studio Joinery',
        model: 'Custom Desk A',
        dimensions: `14'0" W × 3'6" D × 3'6" H`,
        qty: 1,
        unitCostCents: 840000,
        markupPct: 22,
        status: 'approved',
        materialNames: ['Walnut Veneer', 'Calacatta Stone'],
      },
      {
        itemIdTag: 'LB-002',
        itemName: 'Lounge Chair',
        category: 'Seating',
        vendor: 'Northline',
        model: 'Harbor Chair',
        dimensions: `32" W × 34" D × 30" H`,
        qty: 4,
        unitCostCents: 185000,
        markupPct: 28,
        status: 'ordered',
        materialNames: ['Ivory Boucle', 'Smoked Bronze'],
      },
      {
        itemIdTag: 'LB-003',
        itemName: 'Coffee Table',
        category: 'Tables',
        vendor: 'Stone & Field',
        model: 'Plinth 48',
        dimensions: `48" W × 30" D × 16" H`,
        qty: 2,
        unitCostCents: 126000,
        markupPct: 24,
        status: 'pending',
        materialNames: ['Travertine', 'Walnut Veneer'],
      },
      {
        itemIdTag: 'LB-004',
        itemName: 'Feature Pendant',
        category: 'Lighting',
        vendor: 'Luma Studio',
        model: 'Halo 54',
        dimensions: `54" Dia × 18" H`,
        qty: 1,
        unitCostCents: 212000,
        markupPct: 26,
        status: 'received',
        materialNames: ['Linen Oak', 'Smoked Bronze'],
      },
    ],
  },
  {
    name: 'Guest Lounge',
    items: [
      {
        itemIdTag: 'GL-001',
        itemName: 'Sectional Sofa',
        category: 'Seating',
        vendor: 'Atelier Forma',
        model: 'Drift Sectional',
        dimensions: `126" W × 84" D × 31" H`,
        qty: 1,
        unitCostCents: 495000,
        markupPct: 25,
        status: 'approved',
        materialNames: ['Moss Velvet', 'Walnut Veneer'],
      },
      {
        itemIdTag: 'GL-002',
        itemName: 'Side Table',
        category: 'Tables',
        vendor: 'Northline',
        model: 'Mora Side Table',
        dimensions: `20" Dia × 22" H`,
        qty: 3,
        unitCostCents: 58000,
        markupPct: 24,
        status: 'ordered',
        materialNames: ['Smoked Bronze', 'Calacatta Stone'],
      },
      {
        itemIdTag: 'GL-003',
        itemName: 'Area Rug',
        category: 'Flooring',
        vendor: 'Weave House',
        model: 'Tidal Loom',
        dimensions: `12'0" W × 15'0" D`,
        qty: 1,
        unitCostCents: 264000,
        markupPct: 18,
        status: 'pending',
        materialNames: ['Sand Weave'],
      },
      {
        itemIdTag: 'GL-004',
        itemName: 'Floor Lamp',
        category: 'Lighting',
        vendor: 'Luma Studio',
        model: 'Column Lamp',
        dimensions: `18" W × 18" D × 68" H`,
        qty: 2,
        unitCostCents: 97000,
        markupPct: 27,
        status: 'approved',
        materialNames: ['Linen Oak', 'Smoked Bronze'],
      },
    ],
  },
];

const DEMO_MATERIALS: Array<{ name: string; materialId: string; hex: string }> = [
  { name: 'Walnut Veneer', materialId: 'MAT-001', hex: '#8b5e3c' },
  { name: 'Calacatta Stone', materialId: 'MAT-002', hex: '#ddd7cf' },
  { name: 'Ivory Boucle', materialId: 'MAT-003', hex: '#ece5d8' },
  { name: 'Smoked Bronze', materialId: 'MAT-004', hex: '#5a4a42' },
  { name: 'Travertine', materialId: 'MAT-005', hex: '#cfbe9f' },
  { name: 'Linen Oak', materialId: 'MAT-006', hex: '#d0b48f' },
  { name: 'Moss Velvet', materialId: 'MAT-007', hex: '#6a7453' },
  { name: 'Sand Weave', materialId: 'MAT-008', hex: '#cdbda2' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatCents(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

const STATUS_STYLES: Record<ItemStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  ordered: 'bg-blue-50 text-blue-700',
  approved: 'bg-green-50 text-green-700',
  received: 'bg-emerald-50 text-emerald-800',
};

// ─── Component ─────────────────────────────────────────────────────────────

export function DemoPage() {
  const totalItems = DEMO_ROOMS.flatMap((r) => r.items).reduce((sum, i) => sum + i.qty, 0);
  const totalCents = DEMO_ROOMS.flatMap((r) => r.items).reduce(
    (sum, i) => sum + i.unitCostCents * i.qty,
    0,
  );

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 md:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <header>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-500">
            Sample Project
          </p>
          <h1 className="font-display mt-1 text-3xl font-semibold text-neutral-900">
            Interior Design Co. — Lobby Renovation
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Los Angeles, CA &middot; {totalItems} items &middot; {formatCents(totalCents)} total
            cost
          </p>
        </header>

        {/* FF&E rooms */}
        {DEMO_ROOMS.map((room) => (
          <section key={room.name}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
              {room.name}
            </h2>
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    <th className="px-4 py-2">ID</th>
                    <th className="px-4 py-2">Item</th>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2">Vendor / Model</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Unit Cost</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {room.items.map((item, i) => (
                    <tr
                      key={item.itemIdTag}
                      className={[
                        'border-neutral-100',
                        i < room.items.length - 1 ? 'border-b' : '',
                      ].join(' ')}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-neutral-400">
                        {item.itemIdTag}
                      </td>
                      <td className="px-4 py-3 font-medium text-neutral-900">{item.itemName}</td>
                      <td className="px-4 py-3 text-neutral-500">{item.category}</td>
                      <td className="px-4 py-3 text-neutral-500">
                        {item.vendor}
                        {item.model ? (
                          <span className="text-neutral-400"> / {item.model}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-700">{item.qty}</td>
                      <td className="px-4 py-3 text-right text-neutral-700">
                        {formatCents(item.unitCostCents)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={[
                            'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                            STATUS_STYLES[item.status],
                          ].join(' ')}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        {/* Materials palette */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Materials
          </h2>
          <div className="flex flex-wrap gap-3">
            {DEMO_MATERIALS.map((mat) => (
              <div key={mat.materialId} className="flex items-center gap-2">
                <span
                  className="h-6 w-6 rounded-full border border-neutral-200 shadow-sm"
                  style={{ backgroundColor: mat.hex }}
                />
                <span className="text-sm text-neutral-600">{mat.name}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
