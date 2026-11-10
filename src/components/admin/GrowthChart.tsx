import React, { useId, useState } from 'react';
import { AdminPoint } from '../../utils/api';

function compact(value: number, kind: 'usd' | 'count') {
  if (kind === 'count') return Math.round(value).toLocaleString();
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function GrowthChart({ points, kind }: { points: AdminPoint[]; kind: 'usd' | 'count' }) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) {
    return <p className="text-cream-400 text-sm py-8">Not enough recorded history to show a trend.</p>;
  }
  const width = 420;
  const height = 170;
  const pad = { l: 58, r: 16, t: 16, b: 28 };
  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const flatPadding = Math.abs(high) * 0.1 || 1;
  const min = low === high ? Math.max(0, low - flatPadding) : low;
  const max = low === high ? high + flatPadding : high;
  const span = max - min || Math.abs(max) || 1;
  const plotBottom = height - pad.b;
  const yAt = (value: number) => pad.t + (1 - (value - min) / span) * (plotBottom - pad.t);
  const xAt = (index: number) => pad.l + (index / (points.length - 1)) * (width - pad.l - pad.r);
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${xAt(index).toFixed(1)},${yAt(point.value).toFixed(1)}`).join(' ');
  const area = `${line} L${xAt(points.length - 1).toFixed(1)},${plotBottom} L${xAt(0).toFixed(1)},${plotBottom} Z`;
  const active = hover == null ? points.length - 1 : hover;
  const ticks = [0, Math.floor(points.length / 2), points.length - 1];
  const yTicks = [max, (max + min) / 2, min];

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-cream-400 my-3">
        <span className="text-cream-100 text-xl font-semibold tabular-nums">{compact(points[active].value, kind)}</span>
        <span>{points[active].t}</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Historical trend: ${compact(points[0].value, kind)} to ${compact(points[points.length - 1].value, kind)}. Use arrow keys to inspect recorded values.`}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            setHover(Math.max(0, Math.min(points.length - 1, active + (event.key === 'ArrowRight' ? 1 : -1))));
          }
        }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = ((event.clientX - rect.left) / rect.width * width - pad.l) / (width - pad.l - pad.r);
          const index = Math.round(ratio * (points.length - 1));
          setHover(Math.max(0, Math.min(points.length - 1, index)));
        }}
      >
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2" /><stop offset="100%" stopColor="#38bdf8" stopOpacity="0" /></linearGradient></defs>
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={pad.l} x2={width - pad.r} y1={yAt(tick)} y2={yAt(tick)} stroke="#28303a" />
            <text x={pad.l - 8} y={yAt(tick) + 4} textAnchor="end" fill="#8593a5" fontSize="11">
              {compact(tick, kind)}
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke="#38bdf8" strokeWidth="2" />
        <line
          x1={xAt(active)}
          x2={xAt(active)}
          y1={pad.t}
          y2={plotBottom}
          stroke="#a8a191"
          strokeDasharray="3 3"
        />
        <circle cx={xAt(active)} cy={yAt(points[active].value)} r="3.5" fill="#0ea5e9" />
        {ticks.map((index) => (
          <text key={points[index].t} x={xAt(index)} y={height - 8} textAnchor="middle" fill="#8593a5" fontSize="11">
            {points[index].t.slice(5)}
          </text>
        ))}
      </svg>
    </div>
  );
}
