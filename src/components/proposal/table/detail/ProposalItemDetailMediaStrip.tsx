import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../../../../lib/api';
import { useImages } from '../../../../hooks';
import { cn } from '../../../../lib/utils';
import type { ImageAsset } from '../../../../types';
import { ImageFrame } from '../../../shared/image/ImageFrame';
import { PanZoomFrame } from '../../../shared/image/PanZoomFrame';

type ProposalItemDetailMediaStripProps = {
  itemId: string;
  itemProductTag: string | null | undefined;
};

export function ProposalItemDetailMediaStrip({
  itemId,
  itemProductTag,
}: ProposalItemDetailMediaStripProps) {
  const itemLabel = itemProductTag || 'Proposal';

  return (
    <div className="flex w-full gap-5 justify-center border-b border-neutral-200 bg-canvas-shell p-5">
      <ImageSection label="Rendering" className="flex-1 min-w-0">
        <ImageFrame
          entityType="proposal_item"
          entityId={itemId}
          alt={`${itemLabel} rendering`}
          className="w-full aspect-[117/75] flex-shrink-0"
        />
      </ImageSection>

      <ImageSection label="Plan" className="flex-1 min-w-0">
        <PanZoomFrame
          entityType="proposal_plan"
          entityId={itemId}
          alt={`${itemLabel} plan`}
          editable
        />
      </ImageSection>

      <SwatchGallery itemId={itemId} />
    </div>
  );
}

function ImageSection({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="eyebrow mb-2">{label}</p>
      {children}
    </div>
  );
}

function SwatchGallery({ itemId }: { itemId: string }) {
  const { data: swatches } = useImages('proposal_swatch', itemId);
  if (!swatches?.length) return null;

  return (
    <ImageSection label="Swatches">
      <div className="grid grid-cols-2 gap-2">
        {swatches.map((swatch) => (
          <BlobImage key={swatch.id} image={swatch} className="h-24 w-full object-cover" />
        ))}
      </div>
    </ImageSection>
  );
}

function BlobImage({ image, className }: { image: ImageAsset; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    let objectUrl: string | null = null;

    void api.images
      .getContentBlob(image.id)
      .then((blob) => {
        if (ignore) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {});

    return () => {
      ignore = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image.id]);

  if (!url) {
    return <div className={cn('animate-pulse bg-canvas-shell', className)} />;
  }
  return <img src={url} alt={image.altText} className={className} />;
}
