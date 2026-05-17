import type { ReactNode } from 'react';
import type { Material } from '../../../types';
import { MaterialBadges } from '../../materials';

type GeneratedItemMaterialBadgesProps = {
  materials: Material[];
  onOpen: () => void;
};

type GeneratedItemMaterialsCellProps = GeneratedItemMaterialBadgesProps & {
  children?: ReactNode;
};

export function GeneratedItemMaterialBadges({
  materials,
  onOpen,
}: GeneratedItemMaterialBadgesProps) {
  return <MaterialBadges materials={materials} onOpen={onOpen} />;
}

export function GeneratedItemMaterialsCell({
  materials,
  onOpen,
  children,
}: GeneratedItemMaterialsCellProps) {
  return (
    <td className="min-w-36 px-3 py-2" onClick={(event) => event.stopPropagation()}>
      <GeneratedItemMaterialBadges materials={materials} onOpen={onOpen} />
      {children}
    </td>
  );
}
