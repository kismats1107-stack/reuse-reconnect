import { Check, FlaskConical, Trash2 } from "lucide-react";
import { CHALLENGES } from "../../lib/challenges";
import { ms } from "../../lib/format";
import type { RunRecord } from "../../lib/history";
import { CyberCard } from "../layout/CyberCard";

type Props = { history: RunRecord[]; solved: Set<string>; onClear: () => void; onOpenLab: () => void };

const MODE = { compare: "Race both", close: "New connection", keepalive: "Keep-Alive" } as const;

/** Every run finished in the 3D lab, newest first, plus challenge progress. */
export function RunHistory({ history, solved, onClear, onOpenLab }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <CyberCard className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-lg font-semibold">Your lab runs</p>
          {history.length > 0 && (
            <button type="button" onClick={onClear} className="flex items-center gap-1.5 font-mono text-xs text-muted hover:text-text">
              <Trash2 size={13} aria-hidden="true" /> Clear
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <div className="grid place-items-center gap-3 py-8 text-center">
            <FlaskConical className="text-cyan" size={26} aria-hidden="true" />
            <p className="max-w-sm text-sm text-muted">No runs yet. Every race you finish in the 3D lab is recorded here, so you can compare your own experiments.</p>
            <button type="button" className="btn btn-primary" onClick={onOpenLab}>
              Open the 3D lab
            </button>
          </div>
        ) : (
          <div className="-mx-1 max-h-96 overflow-auto">
            <table className="w-full min-w-[40rem] border-collapse font-mono text-[0.78rem]">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-line text-left text-[0.66rem] uppercase tracking-wider text-muted">
                  <th className="px-1 py-2 font-normal">#</th>
                  <th className="px-1 py-2 font-normal">Mode</th>
                  <th className="px-1 py-2 text-right font-normal">Files</th>
                  <th className="px-1 py-2 text-right font-normal">RTT</th>
                  <th className="px-1 py-2 text-right font-normal text-cost">A time</th>
                  <th className="px-1 py-2 text-right font-normal text-lime">B time</th>
                  <th className="px-1 py-2 text-right font-normal">Saved</th>
                  <th className="px-1 py-2 text-right font-normal">Handshakes A/B</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={h.at + i} className="border-b border-line/60">
                    <td className="px-1 py-2 text-faint">{history.length - i}</td>
                    <td className="px-1 py-2">{MODE[h.mode]}</td>
                    <td className="px-1 py-2 text-right">{h.objects}</td>
                    <td className="px-1 py-2 text-right">{h.rttMs} ms</td>
                    <td className="px-1 py-2 text-right">{h.close ? ms(h.close.loadMs) : "—"}</td>
                    <td className="px-1 py-2 text-right">{h.keepalive ? ms(h.keepalive.loadMs) : "—"}</td>
                    <td className="px-1 py-2 text-right font-semibold text-text">{h.close && h.keepalive ? ms(h.close.loadMs - h.keepalive.loadMs) : "—"}</td>
                    <td className="px-1 py-2 text-right">
                      {h.close?.handshakes ?? "—"}/{h.keepalive?.handshakes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CyberCard>

      <CyberCard className="p-5" tone="lime">
        <p className="mb-1 font-display text-lg font-semibold">Challenges</p>
        <p className="mb-4 text-sm text-muted">
          {solved.size}/{CHALLENGES.length} done. Solve them with “Race both” in the lab.
        </p>
        <div className="mb-4 h-2 bg-line">
          <div className="h-full bg-lime transition-[width]" style={{ width: `${(solved.size / CHALLENGES.length) * 100}%` }} />
        </div>
        <ul className="grid gap-2.5">
          {CHALLENGES.map((ch) => {
            const ok = solved.has(ch.id);
            return (
              <li key={ch.id} className={`flex items-start gap-2 text-sm ${ok ? "text-text" : "text-muted"}`}>
                <span aria-hidden="true" className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center border ${ok ? "border-lime bg-lime text-ink" : "border-line-strong"}`}>
                  {ok && <Check size={12} strokeWidth={3} />}
                </span>
                <span>
                  {ch.title}
                  <span className="sr-only">{ok ? " (done)" : " (not done yet)"}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </CyberCard>
    </div>
  );
}
