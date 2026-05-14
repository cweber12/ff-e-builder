import { cn } from '../../../lib/utils';
import type { ProposalStatus } from '../../../types';

/** Configuration for each proposal status stage. */
// PROPOSAL_STATUS_CONFIG is exported for re-use by ProposalStatusSelect and ProposalStatusConfirmModal.
// eslint-disable-next-line react-refresh/only-export-components
export const PROPOSAL_STATUS_CONFIG: Record<
  ProposalStatus,
  {
    label: string;
    stageIndex: number; // 0–3
    filledColor: string; // Tailwind fill class for completed+current dots
    precedingColor: string; // Tailwind fill class for earlier dots
  }
> = {
  in_progress: {
    label: 'IN PROGRESS',
    stageIndex: 0,
    filledColor: 'fill-neutral-400',
    precedingColor: 'fill-neutral-400',
  },
  pricing_complete: {
    label: 'PRICING COMPLETE',
    stageIndex: 1,
    filledColor: 'fill-brand-400',
    precedingColor: 'fill-brand-400/70',
  },
  submitted: {
    label: 'SUBMITTED',
    stageIndex: 2,
    filledColor: 'fill-brand-600',
    precedingColor: 'fill-brand-600/70',
  },
  approved: {
    label: 'APPROVED',
    stageIndex: 3,
    filledColor: 'fill-success-500',
    precedingColor: 'fill-success-500/70',
  },
};

const TOTAL_STAGES = 4;
const DOT_R = 3; // radius px
const DOT_GAP = 4; // gap between dot centers
const DOT_SPACING = DOT_R * 2 + DOT_GAP; // = 10
const SVG_W = TOTAL_STAGES * DOT_SPACING - DOT_GAP; // 36
const SVG_H = DOT_R * 2; // 6

interface ProposalStatusDotsProps {
  status: ProposalStatus;
  className?: string;
}

/**
 * Renders a 4-dot track representing proposal pipeline stage.
 * Reusable in trigger, dropdown options, and modal contexts.
 */
export function ProposalStatusDots({ status, className }: ProposalStatusDotsProps) {
  const cfg = PROPOSAL_STATUS_CONFIG[status];
  const { stageIndex, filledColor, precedingColor } = cfg;

  return (
    <svg
      width={SVG_W}
      height={SVG_H}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      {Array.from({ length: TOTAL_STAGES }, (_, i) => {
        const cx = i * DOT_SPACING + DOT_R;
        const cy = DOT_R;

        if (status === 'approved') {
          // All filled — preceding stages slightly desaturated
          const colorClass = i < TOTAL_STAGES - 1 ? precedingColor : filledColor;
          return <circle key={i} cx={cx} cy={cy} r={DOT_R} className={colorClass} />;
        }

        if (i < stageIndex) {
          // Preceding completed dot
          return <circle key={i} cx={cx} cy={cy} r={DOT_R} className={precedingColor} />;
        }

        if (i === stageIndex) {
          if (stageIndex === 0) {
            // in_progress: just an outline circle
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={DOT_R - 0.5}
                fill="none"
                className={cn('stroke-neutral-400')}
                strokeWidth={0.9}
              />
            );
          }
          // Current stage: half-filled using clipPath
          const clipId = `half-clip-${status}`;
          return (
            <g key={i}>
              <defs>
                <clipPath id={clipId}>
                  <rect x={cx - DOT_R} y={cy - DOT_R} width={DOT_R} height={DOT_R * 2} />
                </clipPath>
              </defs>
              {/* Left half filled */}
              <circle
                cx={cx}
                cy={cy}
                r={DOT_R}
                className={filledColor}
                clipPath={`url(#${clipId})`}
              />
              {/* Full outline */}
              <circle
                cx={cx}
                cy={cy}
                r={DOT_R - 0.5}
                fill="none"
                strokeWidth={0.9}
                className={cn('stroke-neutral-200')}
              />
            </g>
          );
        }

        // Empty future dot — hairline circle
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={DOT_R - 0.5}
            fill="none"
            strokeWidth={0.9}
            className="stroke-neutral-200"
          />
        );
      })}
    </svg>
  );
}
