import type { Material } from '../../../types';
import { MaterialBadges } from '../../materials';

type GeneratedItemMaterialBadgesProps = {
  materials: Material[];
  onOpen: () => void;
};

export function GeneratedItemMaterialBadges({
  materials,
  onOpen,
}: GeneratedItemMaterialBadgesProps) {
  return <MaterialBadges materials={materials} onOpen={onOpen} />;
}
