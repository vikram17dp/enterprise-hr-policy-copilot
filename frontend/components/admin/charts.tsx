"use client";

/**
 * Dependency-free charts (SVG/CSS). The project has no charting library and the
 * spec asks not to add a heavy one, so these small, accessible, responsive
 * components cover the admin analytics needs: a line/area trend, vertical bars,
 * a donut, and a horizontal ranked list.
 */

import { useId } from "react";

import { cn } from "@/lib/utils/cn";

/* ------------------------------- line/area ------------------------------- */

export interface Point {
  label: string;
  value: number;
}

export function LineChart({
  data,
  height = 160,
  className,
  color = "#2563eb",
}: {
  data: Point[];
  height?: number;
  className?: string;
  color?: string;
}) {
  const gid = useId();
  const w = 600;
  const h = height;
  const pad = { top: 10, right: 8, bottom: 20, left: 8 };

  if (!data.length) {
    return <EmptyChart height={height} className={className} />;
  }

  const max = Math.max(1, ...data.map((d) => d.value));
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;
  const step = data.length > 1 ? innerW / (data.length - 1) : 0;

  const coords = data.map((d, i) => {
    const x = pad.left + (data.length > 1 ? i * step : innerW / 2);
    const y = pad.top + innerH - (d.value / max) * innerH;
    return { x, y, ...d };
  });

  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const area = `${line} L${coords[coords.length - 1].x},${pad.top + innerH} L${
    coords[0].x
  },${pad.top + innerH} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn("w-full", className)}
      role="img"
      aria-label="Trend chart"
      preserveAspectRatio="none"
      style={{ height }}
    >
      <defs>
        <linearGradient id={`g-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#g-${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={2.5} fill={color} />
      ))}
    </svg>
  );
}

/* --------------------------------- bars ---------------------------------- */

export function BarChart({
  data,
  height = 160,
  className,
  color = "#2563eb",
}: {
  data: Point[];
  height?: number;
  className?: string;
  color?: string;
}) {
  if (!data.length) return <EmptyChart height={height} className={className} />;
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className={cn("flex w-full items-end gap-1.5", className)} style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[10px] font-medium text-slate-500 tabular-nums">
            {d.value > 0 ? d.value : ""}
          </span>
          <div
            className="w-full rounded-t transition-all"
            style={{
              height: `${Math.max(2, (d.value / max) * (height - 34))}px`,
              backgroundColor: color,
              opacity: d.value === 0 ? 0.25 : 1,
            }}
            title={`${d.label}: ${d.value}`}
          />
          <span className="w-full truncate text-center text-[9px] text-slate-400">
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- donut ---------------------------------- */

export interface Slice {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  data,
  size = 160,
  thickness = 18,
  className,
}: {
  data: Slice[];
  size?: number;
  thickness?: number;
  className?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;

  if (!total) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-full border-[18px] border-slate-100 text-xs text-slate-400",
          className
        )}
        style={{ width: size, height: size }}
        aria-label="No data"
      >
        No data
      </div>
    );
  }

  // Purely computed arc lengths + start offsets (no mutation during render).
  const lengths = data.map((d) => (d.value / total) * c);
  const offsets: number[] = [];
  lengths.reduce((acc, len, i) => {
    offsets[i] = acc;
    return acc + len;
  }, 0);

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Distribution">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {data.map((d, i) => {
            const len = lengths[i];
            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offsets[i]}
              />
            );
          })}
        </g>
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-slate-900 text-lg font-semibold"
        >
          {total}
        </text>
      </svg>
      <ul className="space-y-1.5">
        {data.map((d, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: d.color }} aria-hidden />
            <span className="text-slate-600">{d.label}</span>
            <span className="ml-auto font-medium text-slate-900 tabular-nums">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ----------------------------- horizontal list --------------------------- */

export function RankList({
  data,
  className,
  color = "#2563eb",
  emptyLabel = "No data yet",
}: {
  data: Point[];
  className?: string;
  color?: string;
  emptyLabel?: string;
}) {
  if (!data.length) {
    return (
      <p className={cn("py-6 text-center text-sm text-slate-400", className)}>
        {emptyLabel}
      </p>
    );
  }
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className={cn("space-y-2.5", className)}>
      {data.map((d, i) => (
        <li key={i}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="truncate font-medium text-slate-600">{d.label}</span>
            <span className="ml-2 shrink-0 tabular-nums text-slate-500">{d.value}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyChart({ height, className }: { height: number; className?: string }) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400",
        className
      )}
      style={{ height }}
    >
      No data yet
    </div>
  );
}
