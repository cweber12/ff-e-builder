import { arrayMove } from '@dnd-kit/sortable';
import type { Item } from '../../types';

export function getSortOrderPatches(items: Item[], activeId: string, overId: string) {
  const oldIndex = items.findIndex((item) => item.id === activeId);
  const newIndex = items.findIndex((item) => item.id === overId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return [];

  return arrayMove(items, oldIndex, newIndex)
    .map((item, sortOrder) => ({ item, sortOrder }))
    .filter(({ item, sortOrder }) => item.sortOrder !== sortOrder);
}
