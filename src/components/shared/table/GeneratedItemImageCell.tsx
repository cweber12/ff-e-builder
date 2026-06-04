import type { MouseEventHandler } from 'react';
import type { ImageEntityType } from '../../../types';
import { cn } from '../../../lib/utils';
import { ImageFrame } from '../image/ImageFrame';

type GeneratedItemImageKind = 'rendering' | 'plan';
type GeneratedItemImageView = 'ffe' | 'proposal';

const imageFrameConfig: Record<
  GeneratedItemImageView,
  Record<GeneratedItemImageKind, { entityType: ImageEntityType; frameClassName: string }>
> = {
  ffe: {
    rendering: { entityType: 'item', frameClassName: 'h-20 w-[125px] max-w-full' },
    plan: { entityType: 'item_plan', frameClassName: 'h-20 w-[110px] max-w-full' },
  },
  proposal: {
    rendering: { entityType: 'proposal_item', frameClassName: 'h-20 w-[125px] max-w-full' },
    plan: { entityType: 'proposal_plan', frameClassName: 'h-20 w-[110px] max-w-full' },
  },
};

const proposalCellClassNames: Record<GeneratedItemImageKind, string> = {
  rendering: 'w-40 min-w-40 px-3 py-2',
  plan: 'w-36 min-w-36 px-3 py-2',
};

type GeneratedItemImageControlProps = {
  view: GeneratedItemImageView;
  kind: GeneratedItemImageKind;
  entityId: string;
  alt: string;
  className?: string | undefined;
  eager?: boolean | undefined;
};

export function GeneratedItemImageControl({
  view,
  kind,
  entityId,
  alt,
  className,
  eager,
}: GeneratedItemImageControlProps) {
  const config = imageFrameConfig[view][kind];
  return (
    <ImageFrame
      entityType={config.entityType}
      entityId={entityId}
      alt={alt}
      fallbackUrl={null}
      className={cn(config.frameClassName, className)}
      compact
      eager={eager}
    />
  );
}

type GeneratedItemImageCellProps = GeneratedItemImageControlProps & {
  onClick?: MouseEventHandler<HTMLTableCellElement>;
  tdClassName?: string | undefined;
};

export function GeneratedItemImageCell({
  kind,
  onClick,
  tdClassName,
  ...frameProps
}: GeneratedItemImageCellProps) {
  return (
    <td className={cn(proposalCellClassNames[kind], tdClassName)} onClick={onClick}>
      <GeneratedItemImageControl kind={kind} {...frameProps} />
    </td>
  );
}
