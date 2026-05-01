import { api } from './api';

/**
 * Seeds an example FF&E project for a newly created account.
 * Calls the API directly (not via React Query) so it can be called
 * immediately after Firebase auth before the React tree re-renders.
 */
export async function seedExampleProject(): Promise<void> {
  const project = await api.projects.create({
    name: 'Sample Project',
    clientName: 'Interior Design Co.',
    budgetCents: 3500000, // $35,000
  });

  const [livingRoom, bedroom] = await Promise.all([
    api.rooms.create(project.id, { name: 'Living Room', sortOrder: 0 }),
    api.rooms.create(project.id, { name: 'Primary Bedroom', sortOrder: 1 }),
  ]);

  await Promise.all([
    // ── Living Room ──────────────────────────────────────────────────────────
    api.items.create(livingRoom.id, {
      itemName: 'Lounge Sofa',
      category: 'Seating',
      vendor: 'Herman Miller',
      model: 'Striad Sofa',
      itemIdTag: 'LR-001',
      dimensions: '96"W × 36"D × 32"H',
      qty: 1,
      unitCostCents: 320000,
      markupPct: 30,
      status: 'approved',
      notes: 'COM fabric required — confirm with client',
      sortOrder: 0,
    }),
    api.items.create(livingRoom.id, {
      itemName: 'Coffee Table',
      category: 'Tables',
      vendor: 'Knoll',
      model: 'Saarinen Low Table',
      itemIdTag: 'LR-002',
      dimensions: '48"Ø × 16"H',
      qty: 1,
      unitCostCents: 180000,
      markupPct: 25,
      status: 'ordered',
      sortOrder: 1,
    }),
    api.items.create(livingRoom.id, {
      itemName: 'Area Rug',
      category: 'Flooring',
      vendor: 'ABC Carpet & Home',
      itemIdTag: 'LR-003',
      dimensions: "9' × 12'",
      qty: 1,
      unitCostCents: 240000,
      markupPct: 20,
      status: 'pending',
      sortOrder: 2,
    }),
    api.items.create(livingRoom.id, {
      itemName: 'Floor Lamp',
      category: 'Lighting',
      vendor: 'Flos',
      model: 'Arco Floor Lamp',
      itemIdTag: 'LR-004',
      qty: 2,
      unitCostCents: 110000,
      markupPct: 30,
      status: 'received',
      sortOrder: 3,
    }),

    // ── Primary Bedroom ──────────────────────────────────────────────────────
    api.items.create(bedroom.id, {
      itemName: 'King Bed Frame',
      category: 'Beds',
      vendor: 'Restoration Hardware',
      model: 'Maxwell Upholstered Bed',
      itemIdTag: 'PB-001',
      dimensions: '90"W × 94"D × 58"H',
      qty: 1,
      unitCostCents: 450000,
      markupPct: 25,
      status: 'approved',
      sortOrder: 0,
    }),
    api.items.create(bedroom.id, {
      itemName: 'Nightstand',
      category: 'Tables',
      vendor: 'West Elm',
      model: 'Anton Nightstand',
      itemIdTag: 'PB-002',
      dimensions: '22"W × 18"D × 26"H',
      qty: 2,
      unitCostCents: 48000,
      markupPct: 25,
      status: 'ordered',
      sortOrder: 1,
    }),
    api.items.create(bedroom.id, {
      itemName: 'Dresser',
      category: 'Case Goods',
      vendor: 'Room & Board',
      itemIdTag: 'PB-003',
      dimensions: '64"W × 19"D × 34"H',
      qty: 1,
      unitCostCents: 190000,
      markupPct: 20,
      status: 'pending',
      sortOrder: 2,
    }),
    api.items.create(bedroom.id, {
      itemName: 'Task Chair',
      category: 'Seating',
      vendor: 'Herman Miller',
      model: 'Aeron Chair',
      itemIdTag: 'PB-004',
      qty: 1,
      unitCostCents: 180000,
      markupPct: 30,
      status: 'pending',
      sortOrder: 3,
    }),
  ]);
}
