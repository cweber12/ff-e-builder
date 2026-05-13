import { api } from '../../api';
import type { RoomWithItems } from '../../../types';
import { imageAssetToPngDataUrl } from '../imageHelpers';
// Fetches the primary image data URL for each item in the given rooms.
export async function buildFfeItemImages(
  rooms: RoomWithItems[],
): Promise<Map<string, string | null>> {
  const items = rooms.flatMap((r) => r.items);
  const entries = await Promise.all(
    items.map(async (item) => {
      const images = await api.images.list({ entityType: 'item', entityId: item.id });
      const primary = images.find((img) => img.isPrimary) ?? images[0];
      if (!primary) return [item.id, null] as const;
      return [item.id, await imageAssetToPngDataUrl(primary)] as const;
    }),
  );
  return new Map(entries);
}
