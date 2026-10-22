import { useState, type ReactNode } from "react";
import { useElementSize } from "../../hooks/useElementSize";
import { useInView } from "../../hooks/useInView";

export type Series = {
  key: string;
  label: string;
  color: string;
  dash?: string;
  /** Points sorted by x. */
  points: { x: number; y: number }[];
  /** Draw dots on every point (for measured data). */
  dots?: boolean;
  /** Draw no line between points. */
  noLine?: boolean;
};

/** Nice round step for an axis spanning 0…max with about `n` ticks. */
function niceStep(max: number, n = 5): number {
  if (max <= 0) return 1;
  const raw = max / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw) ?? raw;
}

export function Legend({ items }: { items: { label: string; color: string; dash?: string; dot?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1" aria-label="Legend">
      {items.map((s) => (
        <li key={s.label} className="flex items-center gap-2 text-xs text-muted">
          <svg width="22" height="10" aria-hidden="true">
            {s.dot ? <circle cx="11" cy="5" r="4" fill={s.color} /> : <line x1="0" x2="22" y1="5" y2="5" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dash} />}
          </svg>
          {s.label}
        </li>
      ))}
    </ul>
  );
}

type LineProps = {
  series: Series[];
  height?: number;
  xTicks: number[];
  xLabel: string;
  yFormat: (v: number) => string;
  xFormat?: (v: number) => string;
  /** Vertical marker (e.g. the selected setting). */
  markX?: number;
  markLabel?: string;
  ariaLabel: string;
};

/** Multi-series line chart with a snapping crosshair and tooltip. */
export function LineChart({ series, height = 240, xTicks, xLabel, yFormat, xFormat = String, markX, markLabel, ariaLabel }: LineProps) {
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const [hx, setHx] = useState<number | null>(null);
  const [view, seen] = useInView<HTMLDivElement>();
  const W = Math.max(width, 260);
  const m = { l: 58, r: 14, t: 12, b: 38 };
  const iw = W - m.l - m.r;
  const ih = height - m.t - m.b;
  const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b);
  const xMin = Math.min(...xTicks, ...xs);
  const xMax = Math.max(...xTicks, ...xs);
  const yRaw = Math.max(...series.flatMap((s) => s.points.map((p) => p.y)), 1);
  const step = niceStep(yRaw);
  const yMax = Math.ceil(yRaw / step) * step;
  const x = (v: number) => m.l + ((v - xMin) / Math.max(xMax - xMin, 1)) * iw;
  const y = (v: number) => m.t + ih - (Math.max(0, v) / yMax) * ih;

  return (
    <div ref={view} className={seen ? "is-in" : ""}>
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg
          width={W}
          height={height}
          className="block"
          role="img"
          aria-label={ariaLabel}
          onMouseMove={(ev) => {
            const r = ev.currentTarget.getBoundingClientRect();
            const v = xMin + ((ev.clientX - r.left - m.l) / iw) * (xMax - xMin);
            const near = xs.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), xs[0]);
            setHx(near);
          }}
          onMouseLeave={() => setHx(null)}
        >
          {Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step).map((v) => (
            <g key={v}>
              <line x1={m.l} x2={m.l + iw} y1={y(v)} y2={y(v)} stroke="var(--color-line)" />
              <text x={m.l - 8} y={y(v)} dy="0.35em" textAnchor="end" fontFamily="var(--font-mono)" fontSize={11} fill="var(--color-faint)">
                {v === 0 ? "0" : yFormat(v)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} x={x(t)} y={height - 20} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={11} fill="var(--color-faint)">
              {xFormat(t)}
            </text>
          ))}
          <text x={m.l + iw} y={height - 3} textAnchor="end" fontFamily="var(--font-mono)" fontSize={10} fill="var(--color-faint)">
            {xLabel} →
          </text>
          {markX !== undefined && (
            <g>
              <line x1={x(markX)} x2={x(markX)} y1={m.t} y2={m.t + ih} stroke="var(--color-line-strong)" strokeDasharray="3 3" />
              {markLabel && (
                <text x={x(markX) + 5} y={m.t + 10} fontFamily="var(--font-mono)" fontSize={10} fill="var(--color-muted)">
                  {markLabel}
                </text>
              )}
            </g>
          )}
          <g className="reveal-x">
          {series.map((s) =>
            s.noLine ? null : (
              <path
                key={s.key}
                d={s.points.map((p, i) => `${i ? "L" : "M"}${x(p.x).toFixed(1)} ${y(p.y).toFixed(1)}`).join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dash}
                strokeLinejoin="round"
              />
            ),
          )}
          {series.map((s) => (s.dots ? s.points.map((p) => <circle key={`${s.key}-${p.x}`} cx={x(p.x)} cy={y(p.y)} r={4.5} fill={s.color} stroke="var(--color-surface)" strokeWidth={2} />) : null))}
          </g>
          {hx !== null && (
            <g pointerEvents="none">
              <line x1={x(hx)} x2={x(hx)} y1={m.t} y2={m.t + ih} stroke="var(--color-muted)" strokeOpacity={0.6} />
              {series.map((s) => {
                const p = s.points.find((q) => q.x === hx);
                return p ? <circle key={s.key} cx={x(p.x)} cy={y(p.y)} r={4} fill={s.color} stroke="var(--color-surface)" strokeWidth={2} /> : null;
              })}
            </g>
          )}
        </svg>
      )}
      {hx !== null && (
        <div role="tooltip" className="pointer-events-none absolute top-0 z-10 border border-line-strong bg-raised px-3 py-2 font-mono text-xs shadow-lg" style={{ left: Math.min(x(hx) + 12, W - 200) }}>
          <p className="mb-1 text-muted">
            {xFormat(hx)} {xLabel}
          </p>
          {series.map((s) => {
            const p = s.points.find((q) => q.x === hx);
            return p ? (
              <p key={s.key} className="flex items-center gap-2 text-text">
                <span aria-hidden="true" className="inline-block h-0.5 w-3" style={{ background: s.color }} />
                {s.label}
                <span className="ml-auto pl-4 tabular-nums">{yFormat(p.y)}</span>
              </p>
            ) : null;
          })}
        </div>
      )}
    </div>
    </div>
  );
}

type Group = { label: string; values: { key: string; label: string; value: number; color: string }[] };

/** Vertical grouped bars with values printed on top and a hover tooltip. */
export function BarChart({ groups, height = 240, yFormat, ariaLabel, highlight }: { groups: Group[]; height?: number; yFormat: (v: number) => string; ariaLabel: string; highlight?: string }) {
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);
  const [view, seen] = useInView<HTMLDivElement>();
  const W = Math.max(width, 260);
  const m = { l: 58, r: 10, t: 22, b: 40 };
  const iw = W - m.l - m.r;
  const ih = height - m.t - m.b;
  const yRaw = Math.max(...groups.flatMap((g) => g.values.map((v) => v.value)), 1);
  const step = niceStep(yRaw, 4);
  const yMax = Math.ceil(yRaw / step) * step;
  const y = (v: number) => m.t + ih - (Math.max(0, v) / yMax) * ih;
  const gw = iw / groups.length;
  const n = groups[0]?.values.length ?? 1;
  const bw = Math.min(34, (gw * 0.7) / n);

  return (
    <div ref={view} className={seen ? "is-in" : ""}>
    <div ref={ref}>
      {width > 0 && (
        <svg width={W} height={height} className="block" role="img" aria-label={ariaLabel}>
          {Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step).map((v) => (
            <g key={v}>
              <line x1={m.l} x2={m.l + iw} y1={y(v)} y2={y(v)} stroke="var(--color-line)" />
              <text x={m.l - 8} y={y(v)} dy="0.35em" textAnchor="end" fontFamily="var(--font-mono)" fontSize={11} fill="var(--color-faint)">
                {v === 0 ? "0" : yFormat(v)}
              </text>
            </g>
          ))}
          {groups.map((g, gi) => {
            const cx = m.l + gw * (gi + 0.5);
            const on = highlight === g.label;
            return (
              <g key={g.label}>
                {on && <rect x={cx - gw / 2 + 4} y={m.t - 18} width={gw - 8} height={ih + 18} fill="var(--color-cyan)" opacity={0.05} />}
                {g.values.map((v, vi) => {
                  const bx = cx - (n * bw) / 2 + vi * bw + 1;
                  const id = `${g.label}-${v.key}`;
                  const h = Math.max(0, y(0) - y(v.value));
                  return (
                    <g key={v.key} className="reveal-y" style={{ transitionDelay: `${gi * 90}ms` }} onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)}>
                      <path
                        d={h > 4 ? `M${bx} ${y(0)} V${y(v.value) + 4} q0 -4 4 -4 H${bx + bw - 6} q4 0 4 4 V${y(0)} Z` : `M${bx} ${y(0)} h${bw - 2} v${-h} h${-(bw - 2)} Z`}
                        fill={v.color}
                        opacity={hover && hover !== id ? 0.5 : 1}
                      >
                        <title>{`${g.label} · ${v.label}: ${yFormat(v.value)}`}</title>
                      </path>
                      {(hover === id || n === 1) && (
                        <text x={bx + (bw - 2) / 2} y={y(v.value) - 6} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={11} fill="var(--color-text)">
                          {yFormat(v.value)}
                        </text>
                      )}
                    </g>
                  );
                })}
                <text x={cx} y={height - 22} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={11} fill={on ? "var(--color-text)" : "var(--color-faint)"}>
                  {g.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
    </div>
  );
}

type Stack = { label: string; total: number; parts: { key: string; label: string; value: number; color: string; striped?: boolean }[] };

/** Horizontal stacked bars on one shared axis. */
export function StackBars({ rows, format }: { rows: Stack[]; format: (v: number) => string }) {
  const max = Math.max(...rows.map((r) => r.total), 1);
  const [view, seen] = useInView<HTMLDivElement>();
  const fill = (c: string, striped?: boolean) => (striped ? `repeating-linear-gradient(135deg, ${c} 0 4px, color-mix(in oklab, ${c} 65%, black) 4px 7px)` : c);
  return (
    <div ref={view} className={`grid gap-4 ${seen ? "is-in" : ""}`}>
      {rows.map((r) => (
        <div key={r.label}>
          <p className="mb-1.5 flex justify-between text-sm">
            <span className="text-muted">{r.label}</span>
            <span className="font-mono font-semibold text-text">{format(r.total)}</span>
          </p>
          <div className="reveal-x flex h-7 gap-[2px]" style={{ width: `${(r.total / max) * 100}%` }}>
            {r.parts
              .filter((p) => p.value > 0)
              .map((p, i, arr) => (
                <div
                  key={p.key}
                  title={`${p.label}: ${format(p.value)}`}
                  className="h-full min-w-[3px]"
                  style={{ flexGrow: p.value, flexBasis: 0, background: fill(p.color, p.striped), borderRadius: i === arr.length - 1 ? "0 4px 4px 0" : 0 }}
                />
              ))}
          </div>
        </div>
      ))}
      <Legend items={rows[0].parts.map((p) => ({ label: p.label, color: p.color }))} />
    </div>
  );
}

/** Card chrome shared by every chart on the page. */
export function ChartCard({ title, sub, children, legend }: { title: string; sub?: ReactNode; children: ReactNode; legend?: ReactNode }) {
  return (
    <figure className="m-0 grid gap-3">
      <figcaption>
        <p className="font-display text-lg font-semibold leading-tight">{title}</p>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </figcaption>
      {legend}
      {children}
    </figure>
  );
}
