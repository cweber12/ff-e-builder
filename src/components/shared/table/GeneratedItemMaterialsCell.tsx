import type { Material } from '../../../types';
import { cn } from '../../../lib/utils';
import { MaterialBadges } from '../../materials';

type GeneratedItemMaterialsControlProps = {
  materials: Material[];
  onOpen: () => void;
  onPasteImage?: ((file: File) => Promise<void> | void) | undefined;
  isPasting?: boolean | undefined;
  getFinishName?: ((material: Material) => string | undefined) | undefined;
  tdClassName?: string | undefined;
};

type GeneratedItemMaterialsCellProps = GeneratedItemMaterialsControlProps;

export function GeneratedItemMaterialsControl({
  materials,
  onOpen,
  onPasteImage,
  isPasting,
  getFinishName,
}: GeneratedItemMaterialsControlProps) {
  return (
    <MaterialBadges
      materials={materials}
      onOpen={onOpen}
      onPasteImage={onPasteImage}
      isPasting={isPasting}
      getFinishName={getFinishName}
    />
  );
}

export function GeneratedItemMaterialsCell({
  materials,
  onOpen,
  onPasteImage,
  isPasting,
  getFinishName,
  tdClassName,
}: GeneratedItemMaterialsCellProps) {
  return (
    <td
      className={cn('min-w-36 px-3 py-2', tdClassName)}
      onClick={(event) => event.stopPropagation()}
    >
      <MaterialBadges
        materials={materials}
        onOpen={onOpen}
        onPasteImage={onPasteImage}
        isPasting={isPasting}
        getFinishName={getFinishName}
      />
    </td>
  );
}
