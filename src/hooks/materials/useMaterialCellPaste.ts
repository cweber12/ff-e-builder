import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { imageKeys, itemKeys, proposalKeys } from '../../lib/query';
import type { Material } from '../../types';
import { useCreateFinish } from '../finishes/useFinishes';
import { useUploadImage } from '../shared/useImages';
import { useItemMaterialActions, type MaterialContext } from './useMaterials';

type MaterialCellPasteStatus =
  | 'busy'
  | 'created_material'
  | 'attached_finish'
  | 'overwritten'
  | 'discarded';

type MaterialCellPasteInput = {
  itemId: string;
  materials: Material[];
  file: File;
  confirmOverwrite?: ((material: Material) => boolean) | undefined;
};

const DEFAULT_OVERWRITE_PROMPT =
  'This material already has a finish attached. Overwrite the existing swatch image?';

function defaultConfirmOverwrite() {
  if (typeof window === 'undefined') return true;
  return window.confirm(DEFAULT_OVERWRITE_PROMPT);
}

export function useMaterialCellPaste(projectId: string, context: MaterialContext) {
  const queryClient = useQueryClient();
  const createFinish = useCreateFinish(projectId);
  const materialActions = useItemMaterialActions(context);
  const uploadImage = useUploadImage();
  const inFlightRef = useRef(false);
  const [isPasting, setIsPasting] = useState(false);

  const refreshMaterialCell = useCallback(
    (finishId: string) => {
      const cellQueryKey =
        context.kind === 'ffe'
          ? itemKeys.forRoom(context.itemGroupId)
          : proposalKeys.items(context.itemGroupId);
      void queryClient.invalidateQueries({ queryKey: cellQueryKey });
      void queryClient.invalidateQueries({ queryKey: imageKeys.forEntity('finish', finishId) });
    },
    [context.itemGroupId, context.kind, queryClient],
  );

  const pasteIntoCell = useCallback(
    async ({
      itemId,
      materials,
      file,
      confirmOverwrite = defaultConfirmOverwrite,
    }: MaterialCellPasteInput): Promise<MaterialCellPasteStatus> => {
      if (inFlightRef.current) return 'busy';
      inFlightRef.current = true;
      setIsPasting(true);

      try {
        const primaryMaterial = materials[0] ?? null;
        if (!primaryMaterial) {
          const finish = await createFinish.mutateAsync({ name: '' });
          const createdMaterial = await materialActions.createAndAssign.mutateAsync({
            itemId,
            input: {
              name: '',
              materialId: '',
              finishId: finish.id,
            },
          });

          // Proposal create+assign currently may ignore finish_id; patch explicitly when needed.
          if (createdMaterial.finishId !== finish.id) {
            await materialActions.update.mutateAsync({
              itemId,
              materialId: createdMaterial.id,
              patch: { finishId: finish.id },
            });
          }

          await uploadImage.mutateAsync({
            entityType: 'finish',
            entityId: finish.id,
            file,
            altText: 'Pasted finish swatch',
          });
          refreshMaterialCell(finish.id);

          return 'created_material';
        }

        if (!primaryMaterial.finishId) {
          const finish = await createFinish.mutateAsync({ name: '' });
          await materialActions.update.mutateAsync({
            itemId,
            materialId: primaryMaterial.id,
            patch: { finishId: finish.id },
          });
          await uploadImage.mutateAsync({
            entityType: 'finish',
            entityId: finish.id,
            file,
            altText: 'Pasted finish swatch',
          });
          refreshMaterialCell(finish.id);
          return 'attached_finish';
        }

        if (!confirmOverwrite(primaryMaterial)) return 'discarded';
        await uploadImage.mutateAsync({
          entityType: 'finish',
          entityId: primaryMaterial.finishId,
          file,
          altText: `${primaryMaterial.name || 'Material'} swatch`,
        });
        refreshMaterialCell(primaryMaterial.finishId);
        return 'overwritten';
      } finally {
        inFlightRef.current = false;
        setIsPasting(false);
      }
    },
    [createFinish, materialActions, refreshMaterialCell, uploadImage],
  );

  return {
    pasteIntoCell,
    isPasting,
  };
}
