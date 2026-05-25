import { api } from '../../api';
import type { ImageAsset, ProposalCategoryWithItems } from '../../../types';
import { imageAssetToPngDataUrl } from '../imageHelpers';
import type { ProposalAssetBundle, ProposalSwatchAsset } from './proposalDocument';

export async function buildProposalAssetBundle(
  projectId: string,
  categories: ProposalCategoryWithItems[],
  swatchLimit?: number,
): Promise<ProposalAssetBundle> {
  const projectImages = await api.images.list({ entityType: 'project', entityId: projectId });
  const projectImageData = await Promise.all(
    projectImages.slice(0, 3).map(async (image) => imageAssetToPngDataUrl(image)),
  );

  const renderingByItemId = new Map<string, string>();
  const planByItemId = new Map<string, string>();
  const swatchesByItemId = new Map<string, ProposalSwatchAsset[]>();
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

      const uniqueMaterials = item.materials.filter(
        (material, index, all) =>
          Boolean(material.id) && all.findIndex((other) => other.id === material.id) === index,
      );
      const exportMaterials =
        swatchLimit === undefined ? uniqueMaterials : uniqueMaterials.slice(0, swatchLimit);

      const materialImageSets = await Promise.all(
        exportMaterials.map(async (material) =>
          api.images.list({ entityType: 'material', entityId: material.id }),
        ),
      );
      const swatchPairs = exportMaterials
        .map((material, index) => {
          const image = materialImageSets[index]?.[0];
          return image ? { material, image } : null;
        })
        .filter((pair): pair is { material: (typeof exportMaterials)[number]; image: ImageAsset } =>
          Boolean(pair),
        );

      const swatchData = await Promise.all(
        swatchPairs.map(async (pair) => {
          const image = await imageAssetToPngDataUrl(pair.image);
          return image ? { name: pair.material.name, image } : null;
        }),
      );
      const resolvedSwatches = swatchData.filter(
        (value): value is ProposalSwatchAsset => value !== null,
      );
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
