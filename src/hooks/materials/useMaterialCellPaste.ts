import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { imageKeys, itemKeys, proposalKeys } from '../../lib/query';
import type { ImageAsset, Material } from '../../types';
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
const OVERWRITE_UNDO_WINDOW_MS = 10_000;

function defaultConfirmOverwrite() {
  if (typeof window === 'undefined') return true;
  return window.confirm(DEFAULT_OVERWRITE_PROMPT);
}

function getPrimaryImage(images: ImageAsset[] | null | undefined) {
  if (!images || images.length === 0) return null;
  return images.find((image) => image.isPrimary) ?? images[0];
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
  const getPrimaryFinishImage = useCallback(
    async (finishId: string) => {
      const queryKey = imageKeys.forEntity('finish', finishId);
      const cachedImages = queryClient.getQueryData<ImageAsset[]>(queryKey);
      if (cachedImages !== undefined) return getPrimaryImage(cachedImages);
      const fetchedImages = await queryClient.fetchQuery({
        queryKey,
        queryFn: () => api.images.list({ entityType: 'finish', entityId: finishId }),
      });
      return getPrimaryImage(fetchedImages);
    },
    [queryClient],
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

        let previousPrimaryImage: ImageAsset | null = null;
        try {
          previousPrimaryImage = await getPrimaryFinishImage(primaryMaterial.finishId);
        } catch {
          previousPrimaryImage = null;
        }

        const uploadedImage = await uploadImage.mutateAsync({
          entityType: 'finish',
          entityId: primaryMaterial.finishId,
          file,
          altText: `${primaryMaterial.name || 'Material'} swatch`,
        });
        refreshMaterialCell(primaryMaterial.finishId);

        let undoConsumed = false;
        const undoOverwrite = async () => {
          if (undoConsumed) return;
          undoConsumed = true;
          try {
            if (previousPrimaryImage) {
              await api.images.setPrimary(previousPrimaryImage.id);
            } else {
              await api.images.delete(uploadedImage.id);
            }
            refreshMaterialCell(primaryMaterial.finishId);
            toast.success('Previous swatch restored.');
          } catch {
            undoConsumed = false;
            toast.error('Undo could not restore the previous swatch image.');
          }
        };

        toast.success('Swatch updated.', {
          duration: OVERWRITE_UNDO_WINDOW_MS,
          action: {
            label: 'Undo',
            onClick: () => {
              void undoOverwrite();
            },
          },
        });

        return 'overwritten';
      } finally {
        inFlightRef.current = false;
        setIsPasting(false);
      }
    },
    [createFinish, getPrimaryFinishImage, materialActions, refreshMaterialCell, uploadImage],
  );

  return {
    pasteIntoCell,
    isPasting,
  };
}
