import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { describe, expect, it, vi } from 'vitest';
import type { ProposalItem } from '../../../../types';
import { ProposalRecordRow } from './ProposalRecordRow';

vi.mock('../../../shared/table/GeneratedItemImageCell', () => ({
  GeneratedItemImageControl: ({ kind }: { kind: 'rendering' | 'plan' }) => (
    <div>{kind === 'rendering' ? 'Rendering image' : 'Plan image'}</div>
  ),
}));

vi.mock('../../../shared/table/GeneratedItemMaterialsCell', () => ({
  GeneratedItemMaterialsControl: () => <div>Material badges</div>,
}));

vi.mock('./ProposalItemActionsMenu', () => ({
  ProposalItemActionsMenu: () => <button type="button">Actions</button>,
}));

const item: ProposalItem = {
  id: 'item-1',
  categoryId: 'cat-1',
  productTag: 'F-01',
  itemName: 'Custom Table',
  plan: '',
  drawings: 'A1.03',
  location: 'Kitchen',
  description: 'Rectangular wood table with rounded corners and brushed brass base.',
  notes: '',
  sizeLabel: '72" x 36" x 30"',
  sizeMode: 'imperial',
  sizeW: '72',
  sizeD: '36',
  sizeH: '30',
  sizeUnit: 'ft/in',
  footprintLabel: '18 sq ft',
  footprintW: '72',
  footprintD: '36',
  footprintUnit: 'ft/in',
  footprintArea: 18,
  materials: [],
  cbm: 1.234,
  quantity: 2,
  quantityUnit: 'unit',
  unitCostCents: 65000,
  sortOrder: 0,
  customData: {},
  version: 1,
  createdAt: '2026-06-03T00:00:00Z',
  updatedAt: '2026-06-03T00:00:00Z',
  linkedFfeItemId: null,
};

function Wrapper({ children }: { children: ReactNode }) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  return (
    <DndContext sensors={sensors}>
      <SortableContext items={[item.id]} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

describe('ProposalRecordRow', () => {
  it('renders grouped item, plan, specs, materials, and pricing blocks', () => {
    render(
      <Wrapper>
        <ProposalRecordRow
          item={item}
          otherCategories={[]}
          onDelete={vi.fn()}
          onDuplicate={vi.fn()}
          onAddToFfe={vi.fn()}
          onMove={vi.fn()}
          onRowClick={vi.fn()}
          onSwatchOpen={vi.fn()}
          getMaterialFinishName={() => undefined}
        />
      </Wrapper>,
    );

    expect(screen.getByText('Item')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Specs')).toBeInTheDocument();
    expect(screen.getByText('Materials')).toBeInTheDocument();
    expect(screen.getByText('Pricing')).toBeInTheDocument();

    expect(screen.getByText('Custom Table')).toBeInTheDocument();
    expect(screen.getByText('Kitchen')).toBeInTheDocument();
    expect(screen.getByText('A1.03')).toBeInTheDocument();
    expect(screen.getByText('72" x 36" x 30"')).toBeInTheDocument();
    expect(screen.getByText('18 sq ft')).toBeInTheDocument();
    expect(screen.getByText('1.234')).toBeInTheDocument();
    expect(screen.getByText(/Rectangular wood table/i)).toBeInTheDocument();
    expect(screen.getByText('2 unit')).toBeInTheDocument();
    expect(screen.getByText('$650.00')).toBeInTheDocument();
    expect(screen.getByText('$1,300.00')).toBeInTheDocument();
    expect(screen.queryByText(/item record/i)).not.toBeInTheDocument();
  });
});
