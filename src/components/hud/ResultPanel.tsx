import { Check, Trophy, X } from "lucide-react";
import type { Run } from "../../hooks/useExperiment";
import { CHALLENGES } from "../../lib/challenges";
import { ms } from "../../lib/format";
import { compare, metricsAt } from "../../lib/metrics";
import { finding } from "../../lib/summary";
import type { StrategyRun } from "../../types/experiment";
import { CyberCard } from "../layout/CyberCard";

type Props = { run: Run; solved: Set<string>; onClose: () => void; onAgain: () => void; onResults: () => void };

/** Shown when a run finishes: who won, by how much, and the challenges. */
export function ResultPanel({ run, solved, onClose, onAgain, onResults }: Props) {
  const { close, keepalive } = run;
  const both = close && keepalive;
  const c = both ? compare(close, keepalive) : null;
  const max = Math.max(close?.loadMs ?? 0, keepalive?.loadMs ?? 0, 1);

  return (
    <CyberCard className="pointer-events-auto w-full p-5 backdrop-blur-md" index="RESULT">
      <button type="button" onClick={onClose} className="absolute right-3 top-7 text-muted hover:text-text" aria-label="Close result">
        <X size={18} />
      </button>
      <p className="eyebrow mb-1 flex items-center gap-2 text-[0.68rem]!">
        <Trophy size={14} aria-hidden="true" className="text-lime" />
        {both ? "Race finished" : "Page loaded"}
      </p>
      <h2 className="pr-6 text-2xl font-semibold leading-tight">
        {c ? (c.savedMs > 0.5 ? <>Keep-Alive won by <span className="text-lime">{ms(c.savedMs)}</span></> : "It's a tie!") : `Loaded in ${ms((close ?? keepalive)!.loadMs)}`}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{finding(close, keepalive)}</p>

      <div className="mt-4 grid gap-3">
        {close && <Bar name="A · New connection" run={close} max={max} tone="cost" />}
        {keepalive && <Bar name="B · Keep-Alive" run={keepalive} max={max} tone="lime" />}
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <p className="eyebrow mb-2 text-[0.66rem]!">Challenges · {solved.size}/{CHALLENGES.length}</p>
        <ul className="grid gap-1.5">
          {CHALLENGES.map((ch) => {
            const ok = solved.has(ch.id);
            return (
              <li key={ch.id} className={`flex items-start gap-2 text-sm ${ok ? "text-text" : "text-muted"}`}>
                <span aria-hidden="true" className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center border ${ok ? "border-lime bg-lime text-ink" : "border-line-strong"}`}>
                  {ok && <Check size={12} strokeWidth={3} />}
                </span>
                <span>
                  {ch.title}
                  {!ok && <span className="block text-xs text-faint">Hint: {ch.hint}</span>}
                  <span className="sr-only">{ok ? " (done)" : " (not done yet)"}</span>
                </span>
              </li>
            );
          })}
        </ul>
        {!both && <p className="mt-2 text-xs text-faint">Challenges count in “Race both” mode.</p>}
      </div>

      <div className="mt-5 grid gap-2">
        <button type="button" className="btn btn-primary w-full" onClick={onResults}>
          See all results & charts
        </button>
        <button type="button" className="btn btn-ghost w-full" onClick={onAgain}>
          Change settings and try again
        </button>
      </div>
    </CyberCard>
  );
}

function Bar({ name, run, max, tone }: { name: string; run: StrategyRun; max: number; tone: "cost" | "lime" }) {
  const m = metricsAt(run);
  return (
    <div>
      <p className="mb-1 flex justify-between gap-2 text-xs">
        <span className={tone === "cost" ? "text-cost" : "text-lime"}>{name}</span>
        <span className="font-mono text-text">{ms(run.loadMs)}</span>
      </p>
      <div className="h-2.5 bg-line">
        <div className="h-full" style={{ width: `${(run.loadMs / max) * 100}%`, background: tone === "cost" ? "var(--color-chart-cost)" : "var(--color-chart-lime)" }} />
      </div>
      <p className="mt-1 font-mono text-[0.7rem] text-faint">
        {m.connections} connection{m.connections === 1 ? "" : "s"} · {m.handshakes} handshake{m.handshakes === 1 ? "" : "s"}
      </p>
    </div>
  );
}
