import { useState } from "react";
import { connectionTimes } from "../../lib/connections";
import { ms } from "../../lib/format";
import { simulate } from "../../lib/simulation";
import type { NetworkEvent, StrategyRun } from "../../types/experiment";
import { CyberCard } from "../layout/CyberCard";
import { Legend } from "../hud/Legend";
import { KIND_CSS, packetKind } from "../scene/layout";

const W = 380;
const CX = 64;
const SX = W - 64;
const TOP = 46;
const FILES = [2, 3, 4, 5];
const RTTS = [10, 50, 100];

/** Where along an arrow its label sits, so back-to-back packets stay readable. */
function labelAt(e: NetworkEvent): number {
  // Teardown overlaps the next connection's handshake; its labels sit near the
  // receiving end while handshake labels stay in the middle.
  if (e.phase === "teardown") return 0.78;
  if (e.type === "ACK" && e.phase === "handshake") return 0.74;
  if (e.type === "HTTP_REQUEST") return 0.3;
  return 0.5;
}

function tickStep(endMs: number): number {
  const raw = endMs / 8;
  const mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw) ?? raw;
}

/**
 * Both strategies as classic sequence (ladder) diagrams on one time scale:
 * time runs downward, every arrow is one packet, shaded bands are TCP
 * connections. Keep-Alive's diagram is visibly shorter.
 */
export function SequenceDiagrams() {
  const [n, setN] = useState(3);
  const [rtt, setRtt] = useState(50);
  const close = simulate("close", n, rtt);
  const keep = simulate("keepalive", n, rtt);
  // Same pixels per ms for both, so their heights compare directly.
  const pxPerMs = 560 / close.endMs;
  const step = tickStep(close.endMs);

  return (
    <CyberCard className="p-5 sm:p-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <p className="font-display text-lg font-semibold">Sequence diagrams: every packet, step by step</p>
          <p className="mt-1 text-sm text-muted">
            Time runs downward. Each arrow is one packet between the client (browser) and the server; shaded bands are TCP connections. Both use the same scale, so the shorter diagram finished first.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <fieldset>
            <legend className="eyebrow mb-1.5 text-[0.62rem]!">Files</legend>
            <div className="seg [&_button]:min-h-8! [&_button]:min-w-10!" role="radiogroup" aria-label="Files">
              {FILES.map((f) => (
                <button key={f} type="button" role="radio" aria-checked={n === f} onClick={() => setN(f)}>
                  {f}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="eyebrow mb-1.5 text-[0.62rem]!">Server distance</legend>
            <div className="seg [&_button]:min-h-8! [&_button]:whitespace-nowrap" role="radiogroup" aria-label="Server distance">
              {RTTS.map((r) => (
                <button key={r} type="button" role="radio" aria-checked={rtt === r} onClick={() => setRtt(r)}>
                  {r} ms
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </div>
      <Legend className="mb-5" />
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <p className="mb-2 flex items-center gap-2 font-mono text-xs tracking-widest text-cost">
            <span aria-hidden="true" className="inline-block h-2 w-2 rotate-45 bg-cost" /> A · NEW CONNECTION FOR EVERY FILE
          </p>
          <Ladder run={close} pxPerMs={pxPerMs} step={step} title="New connection" />
        </div>
        <div>
          <p className="mb-2 flex items-center gap-2 font-mono text-xs tracking-widest text-lime">
            <span aria-hidden="true" className="inline-block h-2 w-2 rotate-45 bg-lime" /> B · KEEP-ALIVE
          </p>
          <Ladder run={keep} pxPerMs={pxPerMs} step={step} title="Keep-Alive" />
        </div>
      </div>
    </CyberCard>
  );
}

function Ladder({ run, pxPerMs, step, title }: { run: StrategyRun; pxPerMs: number; step: number; title: string }) {
  const y = (t: number) => TOP + t * pxPerMs;
  const H = y(run.endMs) + 30;
  const conns = connectionTimes(run.events);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`${title}: sequence diagram of ${run.objects} files at ${run.rttMs} ms RTT; page loaded at ${ms(run.loadMs)}.`}>
      <defs>
        {(["handshake", "request", "response", "teardown"] as const).map((k) => (
          <marker key={k} id={`seq-${k}-${run.strategy}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L8 4 L0 8 Z" fill={KIND_CSS[k]} />
          </marker>
        ))}
      </defs>

      {/* lifelines */}
      {[
        [CX, "CLIENT"],
        [SX, "SERVER"],
      ].map(([x, name]) => (
        <g key={name}>
          <text x={x} y={18} textAnchor="middle" fontFamily="var(--font-display)" fontWeight={700} fontSize={12} letterSpacing="0.1em" fill="var(--color-text)">
            {name}
          </text>
          <line x1={x} x2={x} y1={28} y2={H - 10} stroke="var(--color-line-strong)" />
        </g>
      ))}

      {/* time axis */}
      {Array.from({ length: Math.floor(run.endMs / step) + 1 }, (_, i) => i * step).map((t) => (
        <g key={t}>
          <line x1={4} x2={10} y1={y(t)} y2={y(t)} stroke="var(--color-faint)" />
          <text x={12} y={y(t)} dy="0.35em" fontFamily="var(--font-mono)" fontSize={9} fill="var(--color-faint)">
            {t}
          </text>
        </g>
      ))}

      {/* connection bands */}
      {conns.map((c, i) => (
        <g key={c.id}>
          <rect x={CX} y={y(c.syn)} width={SX - CX} height={y(c.closed) - y(c.syn)} fill="var(--color-cyan)" opacity={i % 2 ? 0.035 : 0.065} />
          <text x={SX + 6} y={y(c.syn) + 10} fontFamily="var(--font-mono)" fontSize={9} fill="var(--color-muted)">
            #{c.id}
          </text>
        </g>
      ))}

      {/* packets */}
      {run.events
        .filter((e) => e.type !== "CONNECTION_REUSE")
        .map((e) => {
          const up = e.direction === "client-to-server";
          const kind = packetKind(e);
          const nudge = e.type === "HTTP_REQUEST" ? 4 : 0; // ACK and GET leave back to back
          const x1 = up ? CX : SX;
          const x2 = up ? SX : CX;
          const y1 = y(e.timeMs) + nudge;
          const y2 = y(e.arriveMs) + nudge;
          const f = labelAt(e);
          const label = e.type === "HTTP_REQUEST" ? `GET ${String((e.objectIndex ?? 0) + 1).padStart(2, "0")}` : e.type === "HTTP_RESPONSE" ? "200 OK" : e.label;
          return (
            <g key={e.id}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={KIND_CSS[kind]}
                strokeWidth={kind === "teardown" ? 1 : 1.5}
                strokeDasharray={kind === "teardown" ? "3 2" : undefined}
                markerEnd={`url(#seq-${kind}-${run.strategy})`}
              />
              <text
                x={x1 + (x2 - x1) * f}
                y={y1 + (y2 - y1) * f - 4}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize={kind === "teardown" ? 8.5 : 9.5}
                fontWeight={600}
                fill={KIND_CSS[kind]}
                stroke="var(--color-surface)"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {label}
              </text>
            </g>
          );
        })}

      {/* page loaded */}
      <line x1={CX - 12} x2={SX + 10} y1={y(run.loadMs)} y2={y(run.loadMs)} stroke="var(--color-text)" strokeDasharray="4 3" />
      <text x={SX + 14} y={y(run.loadMs) - 3} fontFamily="var(--font-mono)" fontSize={9} fontWeight={600} fill="var(--color-text)">
        loaded
      </text>
      <text x={SX + 14} y={y(run.loadMs) + 9} fontFamily="var(--font-mono)" fontSize={9} fill="var(--color-muted)">
        {ms(run.loadMs)}
      </text>
    </svg>
  );
}
