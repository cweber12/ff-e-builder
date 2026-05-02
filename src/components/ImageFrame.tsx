import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { api } from '../lib/api';
import {
  isPersistedImageEntityId,
  useDeleteImage,
  useImages,
  useUploadImage,
} from '../hooks/useImages';
import type { ImageEntityType } from '../types';

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
  const [hasEnteredViewport, setHasEnteredViewport] = useState(false);
  const canLoad = isPersistedImageEntityId(entityId);
  const images = useImages(entityType, entityId);
  const upload = useUploadImage(entityType, entityId);
  const deleteImage = useDeleteImage(entityType, entityId);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
    upload.mutate({ file, altText: alt });
  };

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

  const content = (
    <>
      {displayUrl ? (
        <img
          src={displayUrl}
          alt={primaryImage?.altText || alt}
          className={cn('h-full w-full object-cover', imageClassName)}
        />
      ) : (
        <div
          className={cn(
            'flex h-full w-full flex-col items-center justify-center gap-1 bg-surface-muted text-center text-gray-400',
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
      )}
    </>
  );

  return (
    <div
      ref={frameRef}
      className={cn(
        'relative overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm',
        className,
      )}
    >
      {hasImage && !disabled ? (
        <>
          <button
            type="button"
            className="block h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            aria-label={`Open image actions for ${alt}`}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {content}
          </button>
          {menuOpen && (
            <div className="absolute left-2 top-2 z-20 min-w-28 rounded-md border border-gray-200 bg-white p-1 text-xs shadow-lg">
              {canUpload && (
                <button
                  type="button"
                  className="flex w-full items-center rounded px-2 py-1.5 text-left text-gray-700 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                  onClick={() => inputRef.current?.click()}
                >
                  Update
                </button>
              )}
              {canRemove && (
                <button
                  type="button"
                  className="flex w-full items-center rounded px-2 py-1.5 text-left text-danger-600 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-danger-500"
                  onClick={handleRemove}
                >
                  Remove
                </button>
              )}
            </div>
          )}
        </>
      ) : canUpload ? (
        <button
          type="button"
          className="block h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          aria-label={`Upload image for ${alt}`}
          onClick={() => inputRef.current?.click()}
        >
          {content}
        </button>
      ) : (
        content
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
  );
}
