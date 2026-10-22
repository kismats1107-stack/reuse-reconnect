import type { StrategyRun } from "../types/experiment";
import { compare, metricsAt } from "./metrics";
import { ms, pct, plural } from "./format";

/** One plain-language finding, written from the run that was actually played. */
export function finding(close?: StrategyRun, keepalive?: StrategyRun): string {
  const run = close ?? keepalive;
  if (!run) return "Run the experiment to generate a finding.";
  const { objects: n, rttMs: rtt } = run;
  const where = `${plural(n, "object")} at ${rtt} ms RTT`;

  if (n === 0) return "With no objects to fetch, neither strategy opens a connection or performs a handshake.";

  if (!close || !keepalive) {
    const m = metricsAt(run);
    const name = close ? "a new connection per object" : "one kept-alive connection";
    return `With ${where}, ${name} used ${plural(m.connections, "TCP connection")} and ${plural(m.handshakes, "handshake")}, loading in ${ms(run.loadMs)}. Run “Compare both” to measure the difference.`;
  }

  const c = compare(close, keepalive);
  if (n === 1) {
    return `With 1 object there is nothing to reuse: both strategies open one connection and finish in ${ms(close.loadMs)}.`;
  }
  if (rtt === 0) {
    return `With ${where}, Keep-Alive still skips ${plural(c.handshakesAvoided, "handshake")}, but a zero-delay link makes each one free in this model, so both finish in ${ms(keepalive.loadMs)}. Distance is what makes handshakes expensive.`;
  }
  return `With ${where}, Keep-Alive opened 1 connection instead of ${n} and skipped ${plural(c.handshakesAvoided, "handshake")}, finishing ${ms(c.savedMs)} (${pct(c.savedPct)}) sooner.`;
}
