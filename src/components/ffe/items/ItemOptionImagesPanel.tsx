import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../../lib/utils';
import { api } from '../../../lib/api';
import {
  useDeleteImage,
  useImages,
  useSetPrimaryImage,
  useUpdateImageCrop,
  useUploadImage,
} from '../../../hooks';
import type { CropParams, ImageAsset } from '../../../types';
import { CropModal } from '../../shared/CropModal';
import { ImageOptionsMenu } from '../../shared/ImageOptionsMenu';

const OPTION_SLOT_COUNT = 3;
const accept = 'image/jpeg,image/png,image/webp,image/gif';

type ItemOptionImagesPanelProps = {
  itemId: string;
  itemName: string;
  disabled?: boolean;
  className?: string;
};

export function ItemOptionImagesPanel({
  itemId,
  itemName,
  disabled = false,
  className,
}: ItemOptionImagesPanelProps) {
  const images = useImages('item_option', itemId);
  const optionImages = useMemo(
    () =>
      [...(images.data ?? [])]
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
        .slice(0, OPTION_SLOT_COUNT),
    [images.data],
  );
  const slots = Array.from(
    { length: OPTION_SLOT_COUNT },
    (_, index) => optionImages[index] ?? null,
  );

  return (
    <div className={cn('grid gap-3 md:grid-cols-3', className)}>
      {slots.map((image, index) => (
        <ItemOptionImageSlot
          key={image?.id ?? `empty-${index}`}
          itemId={itemId}
          itemName={itemName}
          image={image}
          index={index}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

function ItemOptionImageSlot({
  itemId,
  itemName,
  image,
  index,
  disabled,
}: {
  itemId: string;
  itemName: string;
  image: ImageAsset | null;
  index: number;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const menuAnchorRef = useRef<HTMLButtonElement>(null);
  const upload = useUploadImage('item_option', itemId);
  const deleteImage = useDeleteImage('item_option', itemId);
  const setPrimary = useSetPrimaryImage('item_option', itemId);
  const updateCrop = useUpdateImageCrop('item_option', itemId);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    let nextUrl: string | null = null;

    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });

    if (!image) return undefined;

    void api.images
      .getContentBlob(image.id)
      .then((blob) => {
        if (ignore) return;
        nextUrl = URL.createObjectURL(blob);
        setPreviewUrl(nextUrl);
      })
      .catch(() => {
        if (!ignore) setPreviewUrl(null);
      });

    return () => {
      ignore = true;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [image]);

  const cropParams: CropParams | null =
    image &&
    image.cropX !== null &&
    image.cropY !== null &&
    image.cropWidth !== null &&
    image.cropHeight !== null
      ? {
          cropX: image.cropX,
          cropY: image.cropY,
          cropWidth: image.cropWidth,
          cropHeight: image.cropHeight,
        }
      : null;

  const isBusy =
    upload.isPending || deleteImage.isPending || setPrimary.isPending || updateCrop.isPending;

  const handleFile = (file: File | null | undefined) => {
    if (!file || image || disabled) return;
    setUploadError(null);
    upload.mutate(
      {
        file,
        altText: `${itemName} option ${index + 1}`,
      },
      {
        onError: (error) => {
          setUploadError(error instanceof Error ? error.message : 'Option upload failed');
        },
      },
    );
  };

  const handleCropSave = (params: CropParams) => {
    if (!image) return;
    updateCrop.mutate({ imageId: image.id, params }, { onSuccess: () => setCropOpen(false) });
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
          Option {index + 1}
        </p>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-surface-muted shadow-sm">
        {image ? (
          <label className="absolute right-3 top-3 z-10 inline-flex items-center gap-2 rounded-full bg-white/92 px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm">
            <input
              type="checkbox"
              checked={image.isPrimary}
              disabled={disabled || setPrimary.isPending}
              onChange={() => {
                if (!image.isPrimary) setPrimary.mutate(image.id);
              }}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            Selected
          </label>
        ) : null}
        {image && previewUrl ? (
          <button
            ref={menuAnchorRef}
            type="button"
            aria-label={`Open option image actions for ${itemName} option ${index + 1}`}
            className="block aspect-[117/75] w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <img
              src={previewUrl}
              alt={`${itemName} option ${index + 1}`}
              className="h-full w-full object-contain object-center"
            />
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled || Boolean(image)}
            className="flex aspect-[117/75] w-full items-center justify-center bg-brand-50/40 text-sm font-medium text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-default disabled:text-gray-400"
            onClick={() => inputRef.current?.click()}
          >
            {isBusy ? 'Uploading…' : 'Add option rendering'}
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.currentTarget.value = '';
          }}
        />
      </div>

      <ImageOptionsMenu
        anchorRef={menuAnchorRef}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        canUpdate={false}
        canCrop={Boolean(image) && !disabled}
        canDelete={Boolean(image) && !disabled}
        onCrop={() => setCropOpen(true)}
        onDelete={() => {
          if (image) deleteImage.mutate(image.id);
        }}
      />

      {cropOpen && image && previewUrl ? (
        <CropModal
          open={cropOpen}
          onClose={() => setCropOpen(false)}
          imageUrl={previewUrl}
          aspect={117 / 75}
          initialCrop={cropParams}
          onSave={handleCropSave}
          isSaving={updateCrop.isPending}
        />
      ) : null}

      {uploadError ? <p className="text-xs text-danger-600">{uploadError}</p> : null}
    </div>
  );
}
