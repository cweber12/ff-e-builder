import { Link } from 'react-router-dom';
import { ImageFrame } from '../../shared/image/ImageFrame';
import { ItemStatusChip } from '../../shared/table/ItemStatusChip';
import type { FfeCatalogGroup, Item } from '../../../types';

function compareItemIdTags(a: Item, b: Item): number {
  const left = (a.itemIdTag ?? '').trim();
  const right = (b.itemIdTag ?? '').trim();
  if (!left && !right)
    return a.itemName.localeCompare(b.itemName, undefined, { sensitivity: 'base' });
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
}

type FfeItemListProps = {
  projectId: string;
  groups: FfeCatalogGroup[];
  isLoading?: boolean;
};

export function FfeItemList({ projectId, groups, isLoading = false }: FfeItemListProps) {
  if (isLoading) {
    return (
      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <h2 className="eyebrow">FF&amp;E List</h2>
          <button
            type="button"
            disabled
            className="text-link text-sm font-semibold text-brand-700/60"
          >
            Add +
          </button>
        </header>
        <div className="surface-paper">
          <div className="project-row flex items-center gap-4 px-4 py-4 text-sm text-neutral-500">
            Loading FF&amp;E items...
          </div>
        </div>
      </section>
    );
  }

  const sortedGroups = [...groups].sort((a, b) => a.sortOrder - b.sortOrder);
  const hasItems = sortedGroups.some((group) => group.items.length > 0);

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="eyebrow">FF&amp;E List</h2>
        <button
          type="button"
          disabled
          className="text-link text-sm font-semibold text-brand-700/60 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          aria-label="Add FF&E item"
        >
          Add +
        </button>
      </header>

      {!hasItems ? (
        <div className="surface-paper">
          <div className="project-row px-4 py-6 text-sm text-neutral-500">
            No FF&amp;E-visible items yet.
          </div>
        </div>
      ) : (
        sortedGroups
          .filter((group) => group.items.length > 0)
          .map((group) => {
            const sortedItems = [...group.items].sort(compareItemIdTags);
            return (
              <section key={group.id} className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <h3 className="eyebrow text-brand-600">{group.name}</h3>
                  <span className="num text-[11px] font-semibold text-neutral-500">
                    {group.items.length}
                  </span>
                </div>
                <div className="surface-paper">
                  {sortedItems.map((item, index) => (
                    <article
                      key={item.id}
                      className={[
                        'project-row flex items-center gap-4 px-4 py-3',
                        index > 0 ? 'border-t border-neutral-200' : '',
                        'hover:bg-canvas-shell',
                      ].join(' ')}
                    >
                      <Link
                        to={`/projects/${projectId}/ffe/catalog?item=${item.id}`}
                        className="flex min-w-0 flex-1 items-center gap-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                        aria-label={`Open catalog page for ${item.itemName}`}
                      >
                        <div className="flex-shrink-0 overflow-hidden">
                          <ImageFrame
                            entityType="item"
                            entityId={item.id}
                            alt={item.itemName}
                            className="h-16 w-16 object-cover"
                            compact
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="eyebrow text-neutral-500">
                            {item.itemIdTag || 'No ID tag'}
                          </p>
                          <h4 className="mt-0.5 truncate font-display text-lg font-semibold leading-snug text-neutral-950">
                            {item.itemName}
                          </h4>
                          <ItemStatusChip status={item.status} className="mt-1" />
                        </div>
                      </Link>

                      <button
                        type="button"
                        disabled
                        className="text-link shrink-0 text-xs font-medium text-brand-700/60"
                        aria-label={`Remove ${item.itemName} from FF&E`}
                      >
                        Remove from FF&amp;E
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            );
          })
      )}
    </section>
  );
}
