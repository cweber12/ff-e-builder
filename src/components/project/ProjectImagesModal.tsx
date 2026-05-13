import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
} from 'react';
import { api } from '../../lib/api';
import {
  useDeleteImage,
  useImages,
  useSetPrimaryImage,
  useUpdateImageCrop,
  useUploadImage,
} from '../../hooks';
import type { CropParams, ImageAsset, Project } from '../../types';
import { CROP_ASPECT } from '../../types';
import { Button, Modal } from '../primitives';
import { ImageOptionsMenu } from '../shared/image/ImageOptionsMenu';
import { CropModal } from '../shared/image/CropModal';

type ProjectImagesModalProps = {
  project: Project | null;
  open: boolean;
  onClose: () => void;
};

export function ProjectImagesModal({ project, open, onClose }: ProjectImagesModalProps) {
  if (!project) return null;
  return (
    <Modal open={open} onClose={onClose} title="Project images" className="max-w-3xl">
      <ProjectImagesPanel project={project} />
    </Modal>
  );
}

export function ProjectImagesPanel({ project }: { project: Project }) {
  const images = useImages('project', project.id);
  const upload = useUploadImage('project', project.id);
  const deleteImage = useDeleteImage('project', project.id);
  const setPrimary = useSetPrimaryImage('project', project.id);
  const updateCrop = useUpdateImageCrop('project', project.id);
  const slots = [...(images.data ?? [])].slice(0, 3);
  const [slotErrors, setSlotErrors] = useState<Record<number, string>>({});

  return (
    <div className="grid gap-4">
      <p className="text-sm text-gray-600">
        Add up to three project images and choose the preview image shown on the project card.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {[0, 1, 2].map((slot) => (
          <ProjectImageSlot
            key={slot}
            project={project}
            image={slots[slot] ?? null}
            error={slotErrors[slot] ?? null}
            disabled={upload.isPending || deleteImage.isPending || setPrimary.isPending}
            isCropSaving={updateCrop.isPending}
            onUpload={(file) => {
              setSlotErrors((current) => ({ ...current, [slot]: '' }));
              upload.mutate(
                { file, altText: `${project.name} image ${slot + 1}` },
                {
                  onSuccess: () => {
                    setSlotErrors((current) => ({ ...current, [slot]: '' }));
                  },
                  onError: (err) => {
                    setSlotErrors((current) => ({
                      ...current,
                      [slot]: err instanceof Error ? err.message : 'Image upload failed',
                    }));
                  },
                },
              );
            }}
            onDelete={(imageId) => deleteImage.mutate(imageId)}
            onPrimary={(imageId) => setPrimary.mutate(imageId)}
            onCropSave={(imageId, params) => updateCrop.mutate({ imageId, params })}
          />
        ))}
      </div>
    </div>
  );
}

function ProjectImageSlot({
  project,
  image,
  error,
  disabled,
  isCropSaving,
  onUpload,
  onDelete,
  onPrimary,
  onCropSave,
}: {
  project: Project;
  image: ImageAsset | null;
  error: string | null;
  disabled: boolean;
  isCropSaving: boolean;
  onUpload: (file: File) => void;
  onDelete: (imageId: string) => void;
  onPrimary: (imageId: string) => void;
  onCropSave: (imageId: string, params: CropParams) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const imageButtonRef = useRef<HTMLButtonElement>(null);
  const documentPasteHandlerRef = useRef<((event: ClipboardEvent) => void) | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);

  useEffect(() => {
    let ignore = false;
    let nextUrl: string | null = null;
    setUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    if (!image) return undefined;
    void api.images.getContentBlob(image.id).then((blob) => {
      if (ignore) return;
      nextUrl = URL.createObjectURL(blob);
      setUrl(nextUrl);
    });
    return () => {
      ignore = true;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [image]);

  const label = useMemo(
    () => (image ? `${project.name} image` : `Upload image for ${project.name}`),
    [image, project.name],
  );

  const handleFile = (file: File | null | undefined) => {
    if (!file || disabled) return;
    onUpload(file);
  };

  const handlePaste = (event: ClipboardEvent | ReactClipboardEvent) => {
    if (disabled) return;
    const pastedImage = Array.from(event.clipboardData?.items ?? [])
      .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
      ?.getAsFile();
    if (!pastedImage) return;
    event.preventDefault();
    handleFile(pastedImage);
  };

  const enablePasteTarget = () => {
    if (disabled || documentPasteHandlerRef.current) return;
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

  const cropParams: CropParams | null =
    image?.cropX !== null &&
    image?.cropX !== undefined &&
    image?.cropY !== null &&
    image?.cropY !== undefined &&
    image?.cropWidth !== null &&
    image?.cropWidth !== undefined &&
    image?.cropHeight !== null &&
    image?.cropHeight !== undefined
      ? {
          cropX: image.cropX,
          cropY: image.cropY,
          cropWidth: image.cropWidth,
          cropHeight: image.cropHeight,
        }
      : null;

  return (
    <div className="grid gap-2 rounded-lg border border-gray-200 bg-white p-3">
      {image && url ? (
        <>
          <button
            ref={imageButtonRef}
            type="button"
            disabled={disabled}
            onClick={() => setMenuOpen((o) => !o)}
            onPaste={handlePaste}
            onMouseEnter={enablePasteTarget}
            onMouseLeave={disablePasteTarget}
            onFocus={enablePasteTarget}
            onBlur={disablePasteTarget}
            className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-wait disabled:opacity-70"
            aria-label={label}
            aria-expanded={menuOpen}
          >
            {cropParams ? (
              <img
                src={url}
                alt={label}
                className="absolute"
                style={{
                  width: `${100 / cropParams.cropWidth}%`,
                  height: `${100 / cropParams.cropHeight}%`,
                  left: `${(-cropParams.cropX / cropParams.cropWidth) * 100}%`,
                  top: `${(-cropParams.cropY / cropParams.cropHeight) * 100}%`,
                }}
              />
            ) : (
              <img src={url} alt={label} className="h-full w-full object-cover" />
            )}
          </button>
          <ImageOptionsMenu
            anchorRef={imageButtonRef}
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            canUpdate={!disabled}
            canCrop={!disabled}
            canDelete={!disabled}
            onUpdate={() => inputRef.current?.click()}
            onCrop={() => setCropModalOpen(true)}
            onDelete={() => onDelete(image.id)}
          />
          {cropModalOpen && (
            <CropModal
              open={cropModalOpen}
              onClose={() => setCropModalOpen(false)}
              imageUrl={url}
              aspect={CROP_ASPECT.project ?? 4 / 3}
              initialCrop={cropParams}
              onSave={(params) => {
                onCropSave(image.id, params);
                setCropModalOpen(false);
              }}
              isSaving={isCropSaving}
            />
          )}
        </>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onPaste={handlePaste}
          onMouseEnter={enablePasteTarget}
          onMouseLeave={disablePasteTarget}
          onFocus={enablePasteTarget}
          onBlur={disablePasteTarget}
          className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border border-dashed border-gray-300 bg-surface-muted text-sm font-medium text-gray-500 hover:border-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-wait disabled:opacity-70"
          aria-label={label}
          title={disabled ? label : `${label}. Click to upload or press Ctrl+V to paste`}
        >
          Upload
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
      {image && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700">
            <input
              type="radio"
              name={`project-preview-${project.id}`}
              checked={image.isPrimary}
              onChange={() => onPrimary(image.id)}
              className="h-4 w-4 accent-brand-600"
            />
            Preview
          </label>
          <Button type="button" variant="ghost" size="sm" onClick={() => onDelete(image.id)}>
            Remove
          </Button>
        </div>
      )}
      {error ? <p className="text-xs text-danger-600">{error}</p> : null}
    </div>
  );
}
