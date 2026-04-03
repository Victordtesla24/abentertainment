'use client';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  label?: string;
}

export default function Sparkline({
  data,
  width = 120,
  height = 32,
  color = '#C9A84C',
  label = 'Trend',
}: SparklineProps) {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const padding = 2;
  const effectiveWidth = width - padding * 2;
  const effectiveHeight = height - padding * 2;

  const points = data
    .map((value, index) => {
      const x = padding + (index / (data.length - 1)) * effectiveWidth;
      const y = padding + effectiveHeight - ((value - min) / range) * effectiveHeight;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="mt-1" aria-label={`${label} sparkline chart`}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.7}
        />
        {/* End dot */}
        {data.length > 0 && (
          <circle
            cx={padding + effectiveWidth}
            cy={padding + effectiveHeight - ((data[data.length - 1] - min) / range) * effectiveHeight}
            r={2}
            fill={color}
          />
        )}
      </svg>
    </div>
  );
}
