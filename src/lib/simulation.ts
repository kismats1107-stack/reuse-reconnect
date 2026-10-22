import assetSpec from "../../shared/assets.json";
import type {
  Direction,
  EventType,
  ModelParams,
  NetworkEvent,
  Phase,
  Strategy,
  StrategyRun,
} from "../types/experiment";

/**
 * Deterministic event model for fetching N objects sequentially over HTTP/1.1.
 *
 * Every number the page shows (the animation, the log, the counters, the charts)
 * is derived from the events this file generates. Nothing else invents timings.
 *
 * Timing rules (d = RTT / 2 is the one-way delay):
 *  - A packet takes d to cross the network. A response additionally needs its
 *    serialisation time, bytes / bandwidth, before its last byte arrives.
 *  - The client sends the final handshake ACK and the GET back to back.
 *  - The server needs `serverMs` to produce each response.
 *  - `Connection: close`: the server closes right after the response. The
 *    client opens the next connection as soon as the response has arrived, so
 *    teardown overlaps the next handshake and adds no load time.
 *  - Keep-alive: the next GET goes out on the same connection as soon as the
 *    previous response has arrived. The client closes after the last object.
 */

export const ASSETS: readonly { path: string; bytes: number }[] = assetSpec.assets;
export const MAX_OBJECTS = ASSETS.length;

export const DEFAULT_PARAMS: ModelParams = { bandwidthMbps: 100, serverMs: 1 };

export const OBJECT_PRESETS = [1, 5, 10, 20, 40] as const;
export const RTT_PRESETS = [0, 10, 50, 100] as const;

/** Milliseconds needed to push `bytes` onto a link of `mbps`. */
export function serialisationMs(bytes: number, mbps: number): number {
  return (bytes * 8) / (mbps * 1000);
}

export function formatBytes(bytes: number): string {
  return bytes >= 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} B`;
}

class EventWriter {
  readonly events: NetworkEvent[] = [];
  private seq = 0;
  constructor(private readonly strategy: Strategy) {}

  push(
    type: EventType,
    phase: Phase,
    direction: Direction,
    connectionId: number,
    timeMs: number,
    arriveMs: number,
    label: string,
    objectIndex?: number,
  ): number {
    this.events.push({
      id: `${this.strategy}-${++this.seq}`,
      timeMs,
      arriveMs,
      connectionId,
      direction,
      type,
      phase,
      label,
      ...(objectIndex === undefined ? {} : { objectIndex }),
    });
    return arriveMs;
  }
}

const UP: Direction = "client-to-server";
const DOWN: Direction = "server-to-client";

/** SYN → SYN-ACK → ACK starting at `t`. Returns when the client may send data. */
function handshake(w: EventWriter, conn: number, t: number, d: number): number {
  w.push("SYN", "handshake", UP, conn, t, t + d, "SYN");
  w.push("SYN_ACK", "handshake", DOWN, conn, t + d, t + 2 * d, "SYN-ACK");
  w.push("ACK", "handshake", UP, conn, t + 2 * d, t + 3 * d, "ACK");
  return t + 2 * d;
}

/** GET + 200 OK starting at `t`. Returns when the last response byte reaches the client. */
function exchange(
  w: EventWriter,
  conn: number,
  index: number,
  t: number,
  d: number,
  params: ModelParams,
): number {
  const asset = ASSETS[index];
  const tx = serialisationMs(asset.bytes, params.bandwidthMbps);
  w.push("HTTP_REQUEST", "request", UP, conn, t, t + d, `GET ${asset.path}`, index);
  const sent = t + d + params.serverMs;
  return w.push(
    "HTTP_RESPONSE",
    "request",
    DOWN,
    conn,
    sent,
    sent + d + tx,
    `200 OK · ${formatBytes(asset.bytes)}`,
    index,
  );
}

export function simulate(
  strategy: Strategy,
  objects: number,
  rttMs: number,
  params: ModelParams = DEFAULT_PARAMS,
): StrategyRun {
  const n = Math.max(0, Math.min(MAX_OBJECTS, Math.floor(objects)));
  const d = Math.max(0, rttMs) / 2;
  const w = new EventWriter(strategy);
  let loadMs = 0;

  if (strategy === "close") {
    let t = 0;
    for (let i = 0; i < n; i++) {
      const conn = i + 1;
      const ready = handshake(w, conn, t, d);
      const done = exchange(w, conn, i, ready, d, params);
      // The server closes its side once the response is out (its FIN trails the
      // last data byte); the client answers with its own FIN once it has read it.
      w.push("FIN", "teardown", DOWN, conn, done - d, done, "FIN");
      w.push("FIN", "teardown", UP, conn, done, done + d, "FIN, ACK");
      w.push("ACK", "teardown", DOWN, conn, done + d, done + 2 * d, "ACK");
      loadMs = done;
      t = done;
    }
  } else if (n > 0) {
    let t = handshake(w, 1, 0, d);
    for (let i = 0; i < n; i++) {
      if (i > 0) {
        w.push("CONNECTION_REUSE", "request", UP, 1, t, t, `reuse connection #1 (request ${i + 1}/${n})`, i);
      }
      t = exchange(w, 1, i, t, d, params);
    }
    loadMs = t;
    w.push("FIN", "teardown", UP, 1, t, t + d, "FIN");
    w.push("FIN", "teardown", DOWN, 1, t + d, t + 2 * d, "FIN, ACK");
    w.push("ACK", "teardown", UP, 1, t + 2 * d, t + 3 * d, "ACK");
  }

  // Chronological by departure; the sort is stable, so causal order is kept for ties.
  const events = w.events.sort((a, b) => a.timeMs - b.timeMs);
  const endMs = events.reduce((m, e) => Math.max(m, e.arriveMs), 0);
  return { strategy, objects: n, rttMs, events, loadMs, endMs };
}
