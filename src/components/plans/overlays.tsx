import type { ImagePoint } from '../../lib/plans';

export function LineOverlay({
  start,
  end,
  strokeClassName,
  dotClassName,
  dashed = false,
  label,
}: {
  start: ImagePoint;
  end: ImagePoint;
  strokeClassName: string;
  dotClassName: string;
  dashed?: boolean;
  label?: string | undefined;
}) {
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  return (
    <>
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        className={strokeClassName}
        strokeWidth={3}
        strokeDasharray={dashed ? '10 8' : undefined}
        strokeLinecap="round"
      />
      <circle cx={start.x} cy={start.y} r={5} className={dotClassName} />
      <circle cx={end.x} cy={end.y} r={5} className={dotClassName} />
      {label ? (
        <g>
          <rect
            x={midX - 42}
            y={midY - 20}
            width={84}
            height={18}
            rx={9}
            fill="rgba(255,255,255,0.82)"
          />
          <text
            x={midX}
            y={midY - 8}
            textAnchor="middle"
            fill="#3f3f46"
            fontSize="11"
            fontWeight="600"
            letterSpacing="0.08em"
          >
            {label}
          </text>
        </g>
      ) : null}
    </>
  );
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
      fill={fill ?? (active ? 'rgba(201, 151, 35, 0.16)' : 'rgba(82, 82, 91, 0.08)')}
      stroke={stroke ?? (active ? '#c99723' : '#71717a')}
      strokeWidth={strokeWidth ?? (active ? 3.5 : 2)}
      strokeDasharray={dashed ? '10 8' : undefined}
      strokeLinejoin="round"
    />
  );
}
