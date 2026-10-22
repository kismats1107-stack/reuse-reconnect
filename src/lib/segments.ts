import type { StrategyRun } from "../types/experiment";

export type Segment = { kind: "handshake" | "request"; startMs: number; durMs: number; label: string };

/**
 * Splits a sequential run into back-to-back time segments: each handshake
 * (SYN sent → ACK sent) and each request (GET sent → last response byte).
 * Their durations add up exactly to the page load time.
 */
export function segments(run: StrategyRun): Segment[] {
  const out: Segment[] = [];
  const syn = new Map<number, number>();
  const get = new Map<number, number>();
  for (const e of run.events) {
    if (e.type === "SYN") syn.set(e.connectionId, e.timeMs);
    if (e.type === "ACK" && e.phase === "handshake") {
      const t = syn.get(e.connectionId)!;
      out.push({ kind: "handshake", startMs: t, durMs: e.timeMs - t, label: `handshake #${e.connectionId}` });
    }
    if (e.type === "HTTP_REQUEST") get.set(e.objectIndex!, e.timeMs);
    if (e.type === "HTTP_RESPONSE") {
      const t = get.get(e.objectIndex!)!;
      out.push({ kind: "request", startMs: t, durMs: e.arriveMs - t, label: `file ${e.objectIndex! + 1}` });
    }
  }
  return out.sort((a, b) => a.startMs - b.startMs);
}
