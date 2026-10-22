import type { Metrics, NetworkEvent, StrategyRun } from "../types/experiment";

const isPacket = (e: NetworkEvent) => e.type !== "CONNECTION_REUSE";

/**
 * Counts everything that has happened by simulated time `t`. Called every
 * animation frame with the playback clock, and with `Infinity` for final totals,
 * so live counters and the result cards can never disagree.
 *
 *  - a connection counts as opened when its SYN leaves the client
 *  - a handshake counts as complete when the client sends the final ACK
 *  - a request counts as complete when the last response byte arrives
 */
export function metricsAt(run: StrategyRun, t: number = Infinity): Metrics {
  const synAt = new Map<number, number>();
  const ackAt = new Map<number, number>();
  const m: Metrics = {
    connections: 0,
    handshakes: 0,
    requests: 0,
    reuses: 0,
    packets: 0,
    handshakeMs: 0,
    elapsedMs: Math.max(0, Math.min(t, run.loadMs)),
  };
  for (const e of run.events) {
    if (e.timeMs > t) continue;
    if (isPacket(e)) m.packets++;
    switch (e.type) {
      case "SYN":
        m.connections++;
        synAt.set(e.connectionId, e.timeMs);
        break;
      case "ACK":
        if (e.phase === "handshake") {
          m.handshakes++;
          ackAt.set(e.connectionId, e.timeMs);
        }
        break;
      case "HTTP_RESPONSE":
        if (e.arriveMs <= t) m.requests++;
        break;
      case "CONNECTION_REUSE":
        m.reuses++;
        break;
    }
  }
  for (const [conn, start] of synAt) m.handshakeMs += Math.min(ackAt.get(conn) ?? t, t) - start;
  return m;
}

export type LoadBreakdown = {
  /** Waiting for SYN → SYN-ACK before any data can be sent. */
  handshakeMs: number;
  /** Round trips spent carrying GET requests and their responses. */
  requestMs: number;
  /** Server processing plus payload serialisation (identical in both strategies). */
  serverTransferMs: number;
};

/** Splits page load time into the three parts the comparison chart stacks. */
export function breakdown(run: StrategyRun): LoadBreakdown {
  const handshakeMs = metricsAt(run).handshakeMs;
  const requests = new Map<number, NetworkEvent>();
  let serverTransferMs = 0;
  for (const e of run.events) {
    if (e.objectIndex === undefined) continue;
    if (e.type === "HTTP_REQUEST") requests.set(e.objectIndex, e);
    if (e.type === "HTTP_RESPONSE") {
      const req = requests.get(e.objectIndex)!;
      const server = e.timeMs - req.arriveMs;
      const transfer = e.arriveMs - e.timeMs - (req.arriveMs - req.timeMs);
      serverTransferMs += server + transfer;
    }
  }
  return {
    handshakeMs,
    requestMs: Math.max(0, run.loadMs - handshakeMs - serverTransferMs),
    serverTransferMs,
  };
}

export type Comparison = {
  savedMs: number;
  /** Percentage of the new-connection load time saved; null when not meaningful. */
  savedPct: number | null;
  connectionsAvoided: number;
  handshakesAvoided: number;
};

export function compare(close: StrategyRun, keepalive: StrategyRun): Comparison {
  const a = metricsAt(close);
  const b = metricsAt(keepalive);
  const savedMs = close.loadMs - keepalive.loadMs;
  return {
    savedMs,
    savedPct: close.loadMs > 0 ? (savedMs / close.loadMs) * 100 : null,
    connectionsAvoided: a.connections - b.connections,
    handshakesAvoided: a.handshakes - b.handshakes,
  };
}
