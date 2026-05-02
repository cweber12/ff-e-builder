import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { api } from '../lib/api';
import { isPersistedImageEntityId, useImages, useUploadImage } from '../hooks/useImages';
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
  disabled = false,
  compact = false,
}: ImageFrameProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [hasEnteredViewport, setHasEnteredViewport] = useState(false);
  const canLoad = isPersistedImageEntityId(entityId);
  const images = useImages(entityType, entityId);
  const upload = useUploadImage(entityType, entityId);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const primaryImage = useMemo(
    () => images.data?.find((image) => image.isPrimary) ?? images.data?.[0] ?? null,
    [images.data],
  );
  const displayUrl = imageUrl ?? fallbackUrl;
  const canUpload = canLoad && !disabled && !primaryImage && !fallbackUrl && !upload.isPending;
  const isBusy = images.isLoading || imageLoading || upload.isPending;

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
    if (!file || !canLoad || primaryImage) return;
    upload.mutate({ file, altText: alt });
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
      {canUpload ? (
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
