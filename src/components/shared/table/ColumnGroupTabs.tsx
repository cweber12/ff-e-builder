import { cn } from '../../../lib/utils';
import { ALL_COLUMN_GROUP_ID } from '../../../hooks';
import type { GeneratedItemColumnGroup } from '../../../lib/table/generatedItemTablePresets';

type ColumnGroupTabsProps = {
  /** Column groups from the table preset (the "All" view is added automatically). */
  groups: readonly GeneratedItemColumnGroup[];
  /** Currently active group id, or `'all'`. */
  activeGroupId: string;
  onChange: (groupId: string) => void;
  className?: string | undefined;
};

/**
 * Segmented "view" switcher that pages the table between column groups
 * (Product / Specs / Pricing) so related fields display together without
 * horizontal scrolling. The "All" tab restores the full column set.
 *
 * Shared by the FF&E and Proposal section headers. The selection is owned by
 * the parent table so it stays consistent across every section.
 */
export function ColumnGroupTabs({
  groups,
  activeGroupId,
  onChange,
  className,
}: ColumnGroupTabsProps) {
  const tabs = [{ id: ALL_COLUMN_GROUP_ID, label: 'All' }, ...groups];

  return (
    <div
      role="group"
      aria-label="Filter columns by category"
      className={cn('segmented shrink-0', className)}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-pressed={tab.id === activeGroupId}
          title={`Show ${tab.label} columns`}
          onClick={() => onChange(tab.id)}
          className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
