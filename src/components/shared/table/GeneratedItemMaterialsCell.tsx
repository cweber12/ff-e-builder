import type { Material } from '../../../types';
import { cn } from '../../../lib/utils';
import { MaterialBadges } from '../../materials';

type GeneratedItemMaterialsControlProps = {
  materials: Material[];
  onOpen: () => void;
  tdClassName?: string | undefined;
};

type GeneratedItemMaterialsCellProps = GeneratedItemMaterialsControlProps;

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
}: GeneratedItemMaterialsCellProps) {
  return (
    <td
      className={cn('min-w-36 px-3 py-2', tdClassName)}
      onClick={(event) => event.stopPropagation()}
    >
      <MaterialBadges materials={materials} onOpen={onOpen} />
    </td>
  );
}
