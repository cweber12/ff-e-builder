import { api } from '../../api';
import type { ImageAsset, ProposalCategoryWithItems } from '../../../types';
import { imageAssetToPngDataUrl } from '../imageHelpers';
import type { ProposalAssetBundle } from './proposalDocument';

export async function buildProposalAssetBundle(
  projectId: string,
  categories: ProposalCategoryWithItems[],
  swatchLimit: number,
): Promise<ProposalAssetBundle> {
  const projectImages = await api.images.list({ entityType: 'project', entityId: projectId });
  const projectImageData = await Promise.all(
    projectImages.slice(0, 3).map(async (image) => imageAssetToPngDataUrl(image)),
  );

  const renderingByItemId = new Map<string, string>();
  const planByItemId = new Map<string, string>();
  const swatchesByItemId = new Map<string, string[]>();
  const items = categories.flatMap((category) => category.items);

  await Promise.all(
    items.map(async (item) => {
      const [renderingImages, planImages] = await Promise.all([
        api.images.list({ entityType: 'proposal_item', entityId: item.id }),
        api.images.list({ entityType: 'proposal_plan', entityId: item.id }),
      ]);

      const rendering = renderingImages[0];
      if (rendering) {
        const dataUrl = await imageAssetToPngDataUrl(rendering);
        if (dataUrl) renderingByItemId.set(item.id, dataUrl);
      }
      const plan = planImages[0];
      if (plan) {
        const dataUrl = await imageAssetToPngDataUrl(plan);
        if (dataUrl) planByItemId.set(item.id, dataUrl);
      }

      const materialIds = item.materials
        .map((material) => material.id)
        .filter((id, index, all) => Boolean(id) && all.indexOf(id) === index)
        .slice(0, swatchLimit);

      const materialImageSets = await Promise.all(
        materialIds.map(async (materialId) =>
          api.images.list({ entityType: 'material', entityId: materialId }),
        ),
      );
      const swatchImages = materialImageSets
        .map((images) => images[0])
        .filter((image): image is ImageAsset => Boolean(image));

      const swatchData = await Promise.all(
        swatchImages.slice(0, swatchLimit).map(async (image) => imageAssetToPngDataUrl(image)),
      );
      const resolvedSwatches = swatchData.filter((value): value is string => Boolean(value));
      if (resolvedSwatches.length > 0) {
        swatchesByItemId.set(item.id, resolvedSwatches);
      }
    }),
  );

  return {
    projectImages: projectImageData.filter((value): value is string => Boolean(value)),
    renderingByItemId,
    planByItemId,
    swatchesByItemId,
  };
}
