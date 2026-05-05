import { describe, expect, it } from 'vitest';
import { appendListItem, removeListItem, replaceListItem, updateListItem } from './optimisticList';

describe('optimistic list helpers', () => {
  it('applies append, replace, update, and remove transforms', () => {
    const initial = [
      { id: 'a', name: 'Alpha', count: 1 },
      { id: 'b', name: 'Beta', count: 2 },
    ];

    expect(appendListItem(initial, { id: 'c', name: 'Gamma', count: 3 })).toEqual([
      ...initial,
      { id: 'c', name: 'Gamma', count: 3 },
    ]);

    expect(replaceListItem(initial, 'b', { id: 'b', name: 'Beta Prime', count: 20 })).toEqual([
      initial[0],
      { id: 'b', name: 'Beta Prime', count: 20 },
    ]);

    expect(updateListItem(initial, 'a', (item) => ({ ...item, count: item.count + 1 }))).toEqual([
      { id: 'a', name: 'Alpha', count: 2 },
      initial[1],
    ]);

    expect(removeListItem(initial, 'a')).toEqual([initial[1]]);
  });
});
