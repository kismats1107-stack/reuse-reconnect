import { describe, expect, it } from "vitest";
import { ASSETS, DEFAULT_PARAMS, MAX_OBJECTS, serialisationMs, simulate } from "./simulation";
import { breakdown, compare, metricsAt } from "./metrics";
import { finding } from "./summary";
import type { StrategyRun } from "../types/experiment";

const payloadMs = (n: number) =>
  ASSETS.slice(0, n).reduce((s, a) => s + DEFAULT_PARAMS.serverMs + serialisationMs(a.bytes, DEFAULT_PARAMS.bandwidthMbps), 0);

const count = (run: StrategyRun, type: string) => run.events.filter((e) => e.type === type).length;

describe("zero objects", () => {
  it.each(["close", "keepalive"] as const)("%s opens nothing and takes no time", (s) => {
    const run = simulate(s, 0, 50);
    expect(run.events).toHaveLength(0);
    expect(run.loadMs).toBe(0);
    expect(metricsAt(run)).toMatchObject({ connections: 0, handshakes: 0, requests: 0, packets: 0 });
  });
});

describe("one object", () => {
  it("both strategies are identical", () => {
    const a = simulate("close", 1, 50);
    const b = simulate("keepalive", 1, 50);
    expect(metricsAt(a)).toMatchObject({ connections: 1, handshakes: 1, requests: 1 });
    expect(metricsAt(b)).toMatchObject({ connections: 1, handshakes: 1, requests: 1, reuses: 0 });
    expect(a.loadMs).toBeCloseTo(b.loadMs, 9);
    expect(a.loadMs).toBeCloseTo(2 * 50 + payloadMs(1), 9);
  });
});

describe.each([5, 10, 20, 40])("%i objects", (n) => {
  for (const rtt of [0, 10, 50, 100]) {
    const close = simulate("close", n, rtt);
    const keep = simulate("keepalive", n, rtt);

    it(`rtt ${rtt}: connection and handshake counts`, () => {
      expect(metricsAt(close)).toMatchObject({ connections: n, handshakes: n, requests: n, reuses: 0 });
      expect(metricsAt(keep)).toMatchObject({ connections: 1, handshakes: 1, requests: n, reuses: n - 1 });
      expect(new Set(close.events.map((e) => e.connectionId)).size).toBe(n);
      expect(new Set(keep.events.map((e) => e.connectionId))).toEqual(new Set([1]));
    });

    it(`rtt ${rtt}: load time follows the closed form`, () => {
      expect(close.loadMs).toBeCloseTo(n * 2 * rtt + payloadMs(n), 9);
      expect(keep.loadMs).toBeCloseTo(rtt + n * rtt + payloadMs(n), 9);
      expect(compare(close, keep).savedMs).toBeCloseTo((n - 1) * rtt, 9);
    });

    it(`rtt ${rtt}: both strategies fetch the same objects in the same order`, () => {
      const gets = (r: StrategyRun) => r.events.filter((e) => e.type === "HTTP_REQUEST").map((e) => e.label);
      expect(gets(close)).toEqual(gets(keep));
      expect(gets(close)).toHaveLength(n);
    });

    it(`rtt ${rtt}: breakdown adds up to the load time`, () => {
      for (const run of [close, keep]) {
        const b = breakdown(run);
        expect(b.handshakeMs + b.requestMs + b.serverTransferMs).toBeCloseTo(run.loadMs, 9);
        expect(b.serverTransferMs).toBeCloseTo(payloadMs(n), 9);
      }
      expect(breakdown(close).handshakeMs).toBeCloseTo(n * rtt, 9);
      expect(breakdown(keep).handshakeMs).toBeCloseTo(rtt, 9);
    });
  }
});

describe("event stream", () => {
  const close = simulate("close", 3, 50);
  const keep = simulate("keepalive", 3, 50);

  it("is chronological and causal", () => {
    for (const run of [close, keep]) {
      for (let i = 1; i < run.events.length; i++) {
        expect(run.events[i].timeMs).toBeGreaterThanOrEqual(run.events[i - 1].timeMs);
      }
      for (const e of run.events) expect(e.arriveMs).toBeGreaterThanOrEqual(e.timeMs);
    }
  });

  it("every connection follows SYN → SYN-ACK → ACK → GET → 200 OK → FIN", () => {
    for (let conn = 1; conn <= 3; conn++) {
      const seq = close.events.filter((e) => e.connectionId === conn).map((e) => e.type);
      expect(seq).toEqual(["SYN", "SYN_ACK", "ACK", "HTTP_REQUEST", "HTTP_RESPONSE", "FIN", "FIN", "ACK"]);
    }
  });

  it("packet counts: 8 per connection vs 6 + 2 per object", () => {
    expect(metricsAt(close).packets).toBe(8 * 3);
    expect(metricsAt(keep).packets).toBe(6 + 2 * 3);
    expect(count(keep, "SYN")).toBe(1);
  });

  it("live counters only grow and finish at the final totals", () => {
    for (const run of [close, keep]) {
      let prev = metricsAt(run, -1);
      expect(prev).toMatchObject({ connections: 0, handshakes: 0, requests: 0, elapsedMs: 0 });
      for (let t = 0; t <= run.endMs; t += 5) {
        const m = metricsAt(run, t);
        expect(m.connections).toBeGreaterThanOrEqual(prev.connections);
        expect(m.requests).toBeGreaterThanOrEqual(prev.requests);
        prev = m;
      }
      expect(metricsAt(run, run.endMs)).toEqual(metricsAt(run));
    }
  });

  it("clamps object count to the asset list", () => {
    expect(simulate("close", MAX_OBJECTS + 10, 10).objects).toBe(MAX_OBJECTS);
  });
});

describe("finding", () => {
  it("is generated from the run, not hard-coded", () => {
    const f = finding(simulate("close", 20, 50), simulate("keepalive", 20, 50));
    expect(f).toContain("20 objects at 50 ms RTT");
    expect(f).toContain("instead of 20");
    expect(f).toContain("19 handshakes");
    expect(f).toContain("950 ms");
  });
  it("handles the edge cases honestly", () => {
    expect(finding(simulate("close", 0, 50), simulate("keepalive", 0, 50))).toMatch(/neither strategy opens/);
    expect(finding(simulate("close", 1, 50), simulate("keepalive", 1, 50))).toMatch(/nothing to reuse/);
    expect(finding(simulate("close", 10, 0), simulate("keepalive", 10, 0))).toMatch(/free in this model/);
  });
});
