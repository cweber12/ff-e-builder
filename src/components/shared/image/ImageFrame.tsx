import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type ReactNode,
} from 'react';
import { cn } from '../../../lib/utils';
import { api } from '../../../lib/api';
import {
  isPersistedImageEntityId,
  useDeleteImage,
  useImages,
  useUpdateImageCrop,
  useUploadImage,
} from '../../../hooks';
import type { CropParams, ImageEntityType } from '../../../types';
import { CROP_ASPECT, CROPPABLE_ENTITY_TYPES } from '../../../types';
import { ImageOptionsMenu } from './ImageOptionsMenu';
import { CropModal } from './CropModal';

type ImageFrameProps = {
  entityType: ImageEntityType;
  entityId: string;
  alt: string;
  fallbackUrl?: string | null;
  className?: string;
  imageClassName?: string;
  placeholderClassName?: string;
  placeholderContent?: ReactNode;
  onFallbackDelete?: (() => Promise<void> | void) | undefined;
  disabled?: boolean;
  compact?: boolean;
};

const accept = 'image/jpeg,image/png,image/webp,image/gif';

export function ImageFrame({
  entityType,
  entityId,
  alt,
  fallbackUrl = null,
  className,
  imageClassName,
  placeholderClassName,
  placeholderContent,
  onFallbackDelete,
  disabled = false,
  compact = false,
}: ImageFrameProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const menuAnchorRef = useRef<HTMLButtonElement>(null);
  const documentPasteHandlerRef = useRef<((event: ClipboardEvent) => void) | null>(null);
  const [hasEnteredViewport, setHasEnteredViewport] = useState(false);
  const canLoad = isPersistedImageEntityId(entityId);
  const images = useImages(entityType, entityId);
  const upload = useUploadImage(entityType, entityId);
  const deleteImage = useDeleteImage(entityType, entityId);
  const updateCrop = useUpdateImageCrop(entityType, entityId);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const primaryImage = useMemo(
    () => images.data?.find((image) => image.isPrimary) ?? images.data?.[0] ?? null,
    [images.data],
  );
  const displayUrl = imageUrl ?? fallbackUrl;
  const hasImage = Boolean(displayUrl || primaryImage);
  const canUpload = canLoad && !disabled && !upload.isPending;
  const canRemove =
    !disabled && (Boolean(primaryImage) || Boolean(fallbackUrl && onFallbackDelete));
  const isBusy = images.isLoading || imageLoading || upload.isPending || deleteImage.isPending;
  const isRoomImage = entityType === 'room';

  const cropParams: CropParams | null = useMemo(() => {
    if (
      primaryImage?.cropX !== null &&
      primaryImage?.cropX !== undefined &&
      primaryImage?.cropY !== null &&
      primaryImage?.cropY !== undefined &&
      primaryImage?.cropWidth !== null &&
      primaryImage?.cropWidth !== undefined &&
      primaryImage?.cropHeight !== null &&
      primaryImage?.cropHeight !== undefined
    ) {
      return {
        cropX: primaryImage.cropX,
        cropY: primaryImage.cropY,
        cropWidth: primaryImage.cropWidth,
        cropHeight: primaryImage.cropHeight,
      };
    }
    return null;
  }, [primaryImage]);

  const isCroppable = CROPPABLE_ENTITY_TYPES.has(entityType) && Boolean(primaryImage);
  const cropAspect = CROP_ASPECT[entityType] ?? 4 / 3;

  useEffect(() => {
    const node = frameRef.current;
    if (!node || hasEnteredViewport) return undefined;
    if (typeof IntersectionObserver !== 'function') {
      setHasEnteredViewport(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setHasEnteredViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, [hasEnteredViewport]);

  useEffect(() => {
    let ignore = false;
    let nextUrl: string | null = null;

    setImageUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return null;
    });

    if (!primaryImage || !hasEnteredViewport) {
      setImageLoading(false);
      return undefined;
    }

    setImageLoading(true);
    void api.images
      .getContentBlob(primaryImage.id)
      .then((blob) => {
        if (ignore) return;
        nextUrl = URL.createObjectURL(blob);
        setImageUrl(nextUrl);
      })
      .catch(() => {
        if (!ignore) setImageUrl(null);
      })
      .finally(() => {
        if (!ignore) setImageLoading(false);
      });

    return () => {
      ignore = true;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [hasEnteredViewport, primaryImage]);

  const handleFile = (file: File | undefined) => {
    if (!file || !canUpload) return;
    setMenuOpen(false);
    setUploadError(null);
    upload.mutate(
      { file, altText: alt },
      {
        onSuccess: () => setUploadError(null),
        onError: (err) => {
          setUploadError(err instanceof Error ? err.message : 'Image upload failed');
        },
      },
    );
  };

  const handlePaste = (event: ClipboardEvent | ReactClipboardEvent) => {
    if (!canUpload) return;
    const pastedImage = Array.from(event.clipboardData?.items ?? [])
      .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
      ?.getAsFile();
    if (!pastedImage) return;
    event.preventDefault();
    handleFile(pastedImage);
  };

  const enablePasteTarget = () => {
    if (!canUpload || documentPasteHandlerRef.current) return;
    const handler = (event: ClipboardEvent) => handlePaste(event);
    documentPasteHandlerRef.current = handler;
    document.addEventListener('paste', handler);
  };

  const disablePasteTarget = () => {
    const handler = documentPasteHandlerRef.current;
    if (!handler) return;
    document.removeEventListener('paste', handler);
    documentPasteHandlerRef.current = null;
  };

  useEffect(
    () => () => {
      const handler = documentPasteHandlerRef.current;
      if (handler) document.removeEventListener('paste', handler);
    },
    [],
  );

  const handleRemove = () => {
    setMenuOpen(false);
    if (primaryImage) {
      deleteImage.mutate(primaryImage.id);
      return;
    }
    if (fallbackUrl && onFallbackDelete) {
      void Promise.resolve(onFallbackDelete());
    }
  };

  const handleCropSave = (params: CropParams) => {
    if (!primaryImage) return;
    updateCrop.mutate(
      { imageId: primaryImage.id, params },
      { onSuccess: () => setCropModalOpen(false) },
    );
  };

  const imageElement = displayUrl ? (
    cropParams ? (
      // Scale and offset the image so the saved crop region fills the container exactly.
      // The container is already position:relative + overflow:hidden.
      <img
        src={displayUrl}
        alt={primaryImage?.altText || alt}
        style={{
          position: 'absolute',
          width: `${(1 / cropParams.cropWidth) * 100}%`,
          height: `${(1 / cropParams.cropHeight) * 100}%`,
          left: `${(-cropParams.cropX / cropParams.cropWidth) * 100}%`,
          top: `${(-cropParams.cropY / cropParams.cropHeight) * 100}%`,
        }}
      />
    ) : (
      <img
        src={displayUrl}
        alt={primaryImage?.altText || alt}
        className={cn(
          'h-full w-full',
          entityType === 'project' ? 'object-cover' : 'object-contain',
          'object-center',
          imageClassName,
        )}
      />
    )
  ) : (
    <div
      className={cn(
        'flex h-full w-full flex-col items-center justify-center gap-1 text-center text-gray-400',
        !isRoomImage && 'bg-surface-muted',
        placeholderClassName,
      )}
    >
      {isBusy ? (
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      ) : placeholderContent ? (
        placeholderContent
      ) : (
        <>
          <span
            aria-hidden="true"
            className={cn(
              'flex items-center justify-center rounded-full border border-dashed border-gray-300 bg-white text-gray-500',
              compact ? 'h-5 w-5 text-xs' : 'h-9 w-9 text-lg',
            )}
          >
            +
          </span>
          {!compact && canUpload && <span className="text-xs font-medium">Upload image</span>}
        </>
      )}
    </div>
  );

  return (
    <div className="grid gap-1">
      <div
        ref={frameRef}
        tabIndex={canUpload ? 0 : undefined}
        onPaste={handlePaste}
        onMouseEnter={enablePasteTarget}
        onMouseLeave={disablePasteTarget}
        onFocus={enablePasteTarget}
        onBlur={disablePasteTarget}
        onContextMenu={() => {
          if (canUpload) frameRef.current?.focus();
        }}
        title={canUpload ? 'Upload, paste, or update image' : undefined}
        className={cn(
          'relative overflow-hidden',
          // Allow callers to override the border-radius via className; default to rounded-md
          !/rounded-/.test(className ?? '') && 'rounded-md',
          canUpload &&
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
          isRoomImage ? 'bg-transparent' : 'border border-gray-200 bg-surface-muted shadow-sm',
          className,
        )}
      >
        {hasImage && !disabled ? (
          <button
            ref={menuAnchorRef}
            type="button"
            className="block h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            aria-label={`Open image actions for ${alt}`}
            aria-expanded={menuOpen}
            title={`Open image actions for ${alt}`}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {imageElement}
          </button>
        ) : canUpload ? (
          <button
            type="button"
            className="block h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            aria-label={`Upload image for ${alt}`}
            title={`Upload or paste image for ${alt}`}
            onClick={() => inputRef.current?.click()}
          >
            {imageElement}
          </button>
        ) : (
          imageElement
        )}
        {canUpload && (
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
        )}
      </div>

      <ImageOptionsMenu
        anchorRef={menuAnchorRef}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        canUpdate={canUpload}
        canCrop={isCroppable && canUpload}
        canDelete={canRemove}
        onUpdate={() => inputRef.current?.click()}
        onCrop={() => setCropModalOpen(true)}
        onDelete={handleRemove}
      />

      {cropModalOpen && displayUrl && (
        <CropModal
          open={cropModalOpen}
          onClose={() => setCropModalOpen(false)}
          imageUrl={displayUrl}
          aspect={cropAspect}
          onSave={handleCropSave}
          isSaving={updateCrop.isPending}
        />
      )}

      {uploadError ? <p className="text-xs text-danger-600">{uploadError}</p> : null}
    </div>
  );
}
