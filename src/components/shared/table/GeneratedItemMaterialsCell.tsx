import type { Material } from '../../../types';
import { cn } from '../../../lib/utils';
import { MaterialBadges, MaterialSwatchImage } from '../../materials';

type GeneratedItemMaterialsControlProps = {
  materials: Material[];
  onOpen: () => void;
  tdClassName?: string | undefined;
};

type GeneratedItemMaterialsCellProps = GeneratedItemMaterialsControlProps & {
  recentMaterials?: Material[] | undefined;
  onQuickApply?: ((materialId: string) => void) | undefined;
};

export function GeneratedItemMaterialsControl({
  materials,
  onOpen,
}: GeneratedItemMaterialsControlProps) {
  return <MaterialBadges materials={materials} onOpen={onOpen} />;
}

export function GeneratedItemMaterialsCell({
  materials,
  onOpen,
  tdClassName,
  recentMaterials,
  onQuickApply,
}: GeneratedItemMaterialsCellProps) {
  const unassignedRecents = recentMaterials
    ? recentMaterials.filter((r) => !materials.some((a) => a.id === r.id)).slice(0, 5)
    : [];

  return (
    <td
      className={cn('min-w-36 px-3 py-2', tdClassName)}
      onClick={(event) => event.stopPropagation()}
    >
      <GeneratedItemMaterialsControl materials={materials} onOpen={onOpen} />
      {unassignedRecents.length > 0 && onQuickApply && (
        <RecentSwatchStrip recents={unassignedRecents} onApply={onQuickApply} onMore={onOpen} />
      )}
    </td>
  );
}

function RecentSwatchStrip({
  recents,
  onApply,
  onMore,
}: {
  recents: Material[];
  onApply: (materialId: string) => void;
  onMore: () => void;
}) {
  return (
    <div className="mt-1.5 hidden items-center gap-1 group-hover:flex">
      {recents.map((material) => (
        <button
          key={material.id}
          type="button"
          title={material.name}
          aria-label={`Apply ${material.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onApply(material.id);
          }}
          className="rounded-full ring-1 ring-black/10 transition hover:ring-2 hover:ring-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          <MaterialSwatchImage material={material} size="sm" />
        </button>
      ))}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onMore();
        }}
        className="shrink-0 rounded-full bg-canvas-shell px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500 ring-1 ring-black/10 transition hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        More…
      </button>
    </div>
  );
}
