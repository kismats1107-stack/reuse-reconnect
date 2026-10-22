import { Rotate3d } from "lucide-react";
import { useMemo } from "react";
import { ms, pct } from "../../lib/format";
import { compare } from "../../lib/metrics";
import { OBJECT_PRESETS, RTT_PRESETS, simulate } from "../../lib/simulation";
import type { Theme } from "../scene/theme";
import { CyberCard } from "../layout/CyberCard";
import { Towers3D } from "./Towers3D";

type Props = { objects: number; rttMs: number; onObjects: (n: number) => void; onRtt: (r: number) => void; theme: Theme; reduced: boolean };

const DISTANCE: Record<number, string> = { 0: "same computer", 10: "nearby", 50: "other city", 100: "other country" };

/** The result in one picture: 3D time towers plus the setting picker that drives the whole page. */
export function ResultHero({ objects, rttMs, onObjects, onRtt, theme, reduced }: Props) {
  const close = useMemo(() => simulate("close", objects, rttMs), [objects, rttMs]);
  const keep = useMemo(() => simulate("keepalive", objects, rttMs), [objects, rttMs]);
  const c = compare(close, keep);
  return (
    <CyberCard className="overflow-hidden">
      <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="relative h-[340px] border-b border-line sm:h-[440px] lg:border-b-0 lg:border-r">
          <Towers3D close={close} keepalive={keep} theme={theme} reduced={reduced} />
          <p className="pointer-events-none absolute bottom-3 left-4 flex items-center gap-1.5 font-mono text-[0.68rem] text-faint">
            <Rotate3d size={13} aria-hidden="true" /> drag to rotate
          </p>
        </div>
        <div className="grid content-start gap-5 p-5 sm:p-7">
          <div>
            <p className="eyebrow mb-2 text-[0.66rem]!">The result in one picture</p>
            <p className="text-sm leading-relaxed text-muted">
              Each tower is one page load, built from blocks in the order things happen: <b className="text-cost">orange</b> = waiting for a handshake, <b className="text-cyan">blue</b> = fetching one file. Taller = slower.
            </p>
          </div>
          <fieldset>
            <legend className="eyebrow mb-1.5 text-[0.62rem]!">Files on the web page</legend>
            <div className="seg" role="radiogroup" aria-label="Files on the web page">
              {OBJECT_PRESETS.map((n) => (
                <button key={n} type="button" role="radio" aria-checked={objects === n} onClick={() => onObjects(n)}>
                  {n}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="eyebrow mb-1.5 text-[0.62rem]!">Server distance</legend>
            <div className="seg [&_button]:whitespace-nowrap" role="radiogroup" aria-label="Server distance">
              {RTT_PRESETS.map((r) => (
                <button key={r} type="button" role="radio" aria-checked={rttMs === r} onClick={() => onRtt(r)}>
                  {r} ms
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-faint">{DISTANCE[rttMs]}</p>
          </fieldset>
          <div className="grid grid-cols-2 gap-4 border-t border-line pt-5" aria-live="polite">
            <div>
              <p className="font-mono text-[0.62rem] uppercase tracking-wider text-muted">Keep-Alive saves</p>
              <p className="mt-1 font-display text-3xl font-semibold text-lime">{ms(c.savedMs)}</p>
              <p className="text-xs text-faint">{c.savedPct === null ? "—" : `${pct(c.savedPct)} faster`}</p>
            </div>
            <div>
              <p className="font-mono text-[0.62rem] uppercase tracking-wider text-muted">Handshakes</p>
              <p className="mt-1 font-display text-3xl font-semibold">
                <span className="text-cost">{objects}</span> <span className="text-faint">→</span> <span className="text-lime">1</span>
              </p>
              <p className="text-xs text-faint">{c.handshakesAvoided} skipped</p>
            </div>
          </div>
        </div>
      </div>
    </CyberCard>
  );
}
