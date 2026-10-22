import type { ReactNode } from "react";
import { ms } from "../../lib/format";
import { metricsAt } from "../../lib/metrics";
import type { Strategy, StrategyRun } from "../../types/experiment";
import { CyberCard } from "../layout/CyberCard";

type Props = { strategy: Strategy; run?: StrategyRun; clock: number; live: boolean; objects: number };

const NAME: Record<Strategy, [string, string]> = {
  close: ["A", "New connection"],
  keepalive: ["B", "Keep-Alive"],
};

/** Live register board for one lane, like the HUD in a game: values flash when they change. */
export function Scoreboard({ strategy, run, clock, live, objects }: Props) {
  const m = run && live ? metricsAt(run, clock) : null;
  const total = run?.objects ?? objects;
  const done = run && live && clock >= run.loadMs;
  const [letter, name] = NAME[strategy];
  const tone = strategy === "close" ? "cost" : "lime";
  return (
    <CyberCard small tone={tone} className="pointer-events-auto w-full px-3 py-2 backdrop-blur-sm sm:w-[22rem] sm:px-4 sm:py-3">
      <p className={`mb-1 flex items-center sm:mb-2 gap-2 font-mono text-[0.68rem] font-semibold tracking-[0.14em] ${strategy === "close" ? "text-cost" : "text-lime"}`}>
        <span aria-hidden="true" className={`inline-block h-2 w-2 rotate-45 ${strategy === "close" ? "bg-cost" : "bg-lime"}`} />
        {letter} · {name.toUpperCase()}
        {done && <span className="ml-auto text-lime">✓ DONE</span>}
      </p>
      <dl className="grid grid-cols-[1.25fr_1.2fr_0.9fr_1fr] gap-2">
        <Stat label="Connections" value={m?.connections ?? 0} hot={strategy === "close"} />
        <Stat label="Handshakes" value={m?.handshakes ?? 0} hot={strategy === "close"} />
        <Stat
          label="Files"
          value={
            <>
              {m?.requests ?? 0}
              <span className="text-faint">/{total}</span>
            </>
          }
          flashKey={m?.requests ?? 0}
        />
        <Stat label="Time" value={ms(m?.elapsedMs ?? 0)} small />
      </dl>
    </CyberCard>
  );
}

function Stat({ label, value, flashKey, hot, small }: { label: string; value: ReactNode; flashKey?: number; hot?: boolean; small?: boolean }) {
  const key = flashKey ?? (typeof value === "number" ? value : undefined);
  return (
    <div className="min-w-0">
      <dt className="truncate font-mono text-[0.6rem] uppercase tracking-normal text-muted">{label}</dt>
      <dd key={key} className={`m-0 whitespace-nowrap font-display font-semibold tabular-nums leading-tight text-text ${small ? "text-sm sm:text-base" : "text-base sm:text-xl"} ${key ? (hot ? "flash-cost" : "flash") : ""}`}>
        {value}
      </dd>
    </div>
  );
}
