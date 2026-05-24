import type { ReactNode } from 'react';
import type { Material } from '../../../types';
import { MaterialBadges } from '../../materials';

type GeneratedItemMaterialsControlProps = {
  materials: Material[];
  onOpen: () => void;
};

type GeneratedItemMaterialsCellProps = GeneratedItemMaterialsControlProps & {
  children?: ReactNode;
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
  children,
}: GeneratedItemMaterialsCellProps) {
  return (
    <td className="min-w-36 px-3 py-2" onClick={(event) => event.stopPropagation()}>
      <GeneratedItemMaterialsControl materials={materials} onOpen={onOpen} />
      {children}
    </td>
  );
}
