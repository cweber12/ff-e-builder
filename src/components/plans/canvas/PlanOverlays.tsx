import type { ImagePoint } from '../../../lib/plans';

export function LineOverlay({
  start,
  end,
  strokeClassName,
  dotClassName,
  cap = 'dot',
  dashed = false,
  label,
}: {
  start: ImagePoint;
  end: ImagePoint;
  strokeClassName: string;
  dotClassName: string;
  cap?: 'dot' | 'tick';
  dashed?: boolean;
  label?: string | undefined;
}) {
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const tick = getPerpendicularTick(start, end, 14);

  return (
    <>
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        className={strokeClassName}
        strokeWidth={2}
        strokeDasharray={dashed ? '8 6' : undefined}
        strokeLinecap="round"
      />
      {cap === 'tick' ? (
        <>
          <line
            x1={start.x - tick.x}
            y1={start.y - tick.y}
            x2={start.x + tick.x}
            y2={start.y + tick.y}
            className={strokeClassName}
            strokeWidth={1.75}
            strokeLinecap="round"
          />
          <line
            x1={end.x - tick.x}
            y1={end.y - tick.y}
            x2={end.x + tick.x}
            y2={end.y + tick.y}
            className={strokeClassName}
            strokeWidth={1.75}
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <circle cx={start.x} cy={start.y} r={3.5} className={dotClassName} />
          <circle cx={end.x} cy={end.y} r={3.5} className={dotClassName} />
        </>
      )}
      {label ? (
        <g>
          <rect
            x={midX - 46}
            y={midY - 22}
            width={92}
            height={20}
            rx={4}
            fill="rgba(255,255,255,0.94)"
            stroke="rgba(8,14,22,0.12)"
            strokeWidth={1}
          />
          <text
            x={midX}
            y={midY - 9}
            textAnchor="middle"
            fill="#0E1622"
            fontSize="11"
            fontWeight="600"
            letterSpacing="0.02em"
            fontFamily="'JetBrains Mono Variable', ui-monospace, monospace"
          >
            {label}
          </text>
        </g>
      ) : null}
    </>
  );
}

function getPerpendicularTick(start: ImagePoint, end: ImagePoint, length: number) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);

  if (distance <= 0) return { x: 0, y: length / 2 };

  return {
    x: (-dy / distance) * (length / 2),
    y: (dx / distance) * (length / 2),
  };
}

export function RectOverlay({
  points,
  active = false,
  dashed = false,
  fill,
  stroke,
  strokeWidth,
}: {
  points: ImagePoint[];
  active?: boolean;
  dashed?: boolean;
  fill?: string | undefined;
  stroke?: string | undefined;
  strokeWidth?: number | undefined;
}) {
  const pointsAttr = points.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <polygon
      points={pointsAttr}
      fill={fill ?? (active ? 'rgba(255, 230, 0, 0.38)' : 'rgba(41, 53, 69, 0.04)')}
      stroke={stroke ?? (active ? '#FFE600' : '#5C6A7C')}
      strokeWidth={strokeWidth ?? (active ? 1.75 : 1.5)}
      strokeDasharray={dashed ? '8 6' : undefined}
      strokeLinejoin="round"
    />
  );
}
