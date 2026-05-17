import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useColumnConfig } from './useColumnConfig';
import type { CustomColumnDef } from '../../types';

const ffeDefaultColumnIds = [
  'drag',
  'itemIdTag',
  'drawings',
  'image',
  'plan',
  'description',
  'dimensions',
  'materials',
  'itemName',
  'qty',
  'unitCostCents',
  'lineTotal',
  'status',
  'leadTime',
  'notes',
  'actions',
] as const;

const customColumn: CustomColumnDef = {
  id: 'custom-1',
  projectId: 'project-1',
  label: 'Finish Notes',
  sortOrder: 0,
  tableType: 'ffe',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('useColumnConfig', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('rebases stale built-in defaults while preserving hidden and custom columns', () => {
    window.localStorage.setItem(
      'project-1:ffe:columnConfig',
      JSON.stringify({
        order: ['drag', 'image', 'plan', 'itemIdTag', 'itemName', 'category', 'custom-1', 'status'],
        hidden: ['status', 'legacy-hidden'],
      }),
    );

    const { result } = renderHook(() =>
      useColumnConfig('project-1', 'ffe', ffeDefaultColumnIds, [customColumn]),
    );

    expect(result.current.visibleOrder).toEqual([
      'drag',
      'itemIdTag',
      'drawings',
      'image',
      'plan',
      'description',
      'dimensions',
      'materials',
      'itemName',
      'qty',
      'unitCostCents',
      'lineTotal',
      'leadTime',
      'notes',
      'actions',
      'custom-1',
    ]);
    expect(result.current.hiddenDefaults).toEqual(['status']);

    const persisted = JSON.parse(
      window.localStorage.getItem('project-1:ffe:columnConfig') ?? '{}',
    ) as {
      defaultSignature?: unknown;
    };
    expect(persisted.defaultSignature).toBe(ffeDefaultColumnIds.join('|'));
  });
});
