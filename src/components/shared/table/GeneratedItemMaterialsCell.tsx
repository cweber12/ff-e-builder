import type { Material } from '../../../types';
import { MaterialBadges } from '../../materials';

type GeneratedItemMaterialsControlProps = {
  materials: Material[];
  onOpen: () => void;
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
}: GeneratedItemMaterialsControlProps) {
  return (
    <td className="min-w-36 px-3 py-2" onClick={(event) => event.stopPropagation()}>
      <GeneratedItemMaterialsControl materials={materials} onOpen={onOpen} />
    </td>
  );
}
