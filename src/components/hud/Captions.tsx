import { narrate } from "../../lib/narration";
import type { NetworkEvent, Strategy, StrategyRun } from "../../types/experiment";
import { KIND_CSS, packetKind } from "../scene/layout";

type Props = { lanes: { strategy: Strategy; run?: StrategyRun }[]; clock: number; live: boolean };

/** The latest thing that happened in each lane, said in plain words. */
export function Captions({ lanes, clock, live }: Props) {
  const rows = lanes
    .map((l) => ({ strategy: l.strategy, e: live && l.run ? latest(l.run.events, clock) : undefined }))
    .filter((r) => r.e);
  if (rows.length === 0) return null;
  return (
    <div className="pointer-events-none grid gap-1.5" aria-live="polite">
      {rows.map(({ strategy, e }) => {
        const line = narrate(e!);
        const color = e!.type === "CONNECTION_REUSE" ? KIND_CSS.response : KIND_CSS[packetKind(e!)];
        return (
          <p key={strategy} className="caption-line">
            {lanes.length > 1 && <span className={`font-mono text-[0.7rem] font-bold ${strategy === "close" ? "text-cost" : "text-lime"}`}>{strategy === "close" ? "A" : "B"}</span>}
            <span className="tech" style={{ color, borderColor: color }}>
              {line.tech}
            </span>
            <span className="text-muted">{line.who}:</span>
            <span className="truncate text-text">“{line.say}”</span>
          </p>
        );
      })}
    </div>
  );
}

function latest(events: NetworkEvent[], t: number): NetworkEvent | undefined {
  let last: NetworkEvent | undefined;
  for (const e of events) {
    if (e.timeMs > t) break;
    last = e;
  }
  return last;
}
