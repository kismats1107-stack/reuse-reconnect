import type { NetworkEvent } from "../types/experiment";

export type ConnState = "idle" | "opening" | "open" | "closing" | "closed";

/** Key moments in one TCP connection's life, read from the event stream. */
export type ConnTimes = {
  id: number;
  syn: number;
  synArrive: number;
  established: number;
  fin: number;
  closed: number;
};

export function connectionTimes(events: NetworkEvent[]): ConnTimes[] {
  const map = new Map<number, ConnTimes>();
  for (const e of events) {
    let c = map.get(e.connectionId);
    if (!c) {
      c = { id: e.connectionId, syn: Infinity, synArrive: Infinity, established: Infinity, fin: Infinity, closed: 0 };
      map.set(e.connectionId, c);
    }
    if (e.type === "SYN") {
      c.syn = e.timeMs;
      c.synArrive = e.arriveMs;
    }
    if (e.type === "SYN_ACK") c.established = e.arriveMs;
    if (e.type === "FIN") c.fin = Math.min(c.fin, e.timeMs);
    c.closed = Math.max(c.closed, e.arriveMs);
  }
  return [...map.values()].sort((a, b) => a.id - b.id);
}

export function connState(c: ConnTimes, t: number): ConnState {
  if (t < c.syn) return "idle";
  if (t < c.established) return "opening";
  if (t < c.fin) return "open";
  if (t < c.closed) return "closing";
  return "closed";
}
