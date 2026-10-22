import { describe, expect, it } from "vitest";
import { simulate } from "./simulation";
import { narrate, tourSteps } from "./narration";
import { CHALLENGES } from "./challenges";

describe("tour steps", () => {
  for (const strategy of ["close", "keepalive"] as const) {
    it(`${strategy}: every event is explained exactly once, in order`, () => {
      const run = simulate(strategy, 3, 50);
      const steps = tourSteps(run);
      expect(steps.flatMap((s) => s.events)).toEqual(run.events);
      for (let i = 1; i < steps.length; i++) expect(steps[i].target).toBeGreaterThanOrEqual(steps[i - 1].target);
      for (const s of steps) expect(s.target).toBeGreaterThan(s.events[0].timeMs);
    });
  }

  it("ACK and GET are explained together", () => {
    const steps = tourSteps(simulate("close", 1, 50));
    expect(steps.map((s) => s.events.map((e) => e.type))).toContainEqual(["ACK", "HTTP_REQUEST"]);
  });

  it("a reuse step plays until its GET lands", () => {
    const steps = tourSteps(simulate("keepalive", 2, 50));
    const reuse = steps.find((s) => s.events[0].type === "CONNECTION_REUSE")!;
    expect(reuse.events.map((e) => e.type)).toEqual(["CONNECTION_REUSE", "HTTP_REQUEST"]);
    expect(reuse.target).toBe(reuse.events[1].arriveMs);
  });
});

describe("narration", () => {
  it("has a plain sentence for every event", () => {
    for (const e of [...simulate("close", 2, 10).events, ...simulate("keepalive", 2, 10).events]) {
      const l = narrate(e);
      expect(l.say.length).toBeGreaterThan(5);
      expect(l.teach.length).toBeGreaterThan(20);
    }
  });
  it("names the real file", () => {
    const get = simulate("close", 1, 10).events.find((e) => e.type === "HTTP_REQUEST")!;
    expect(narrate(get).say).toBe("Please send me index.html.");
  });
});

describe("challenges", () => {
  const done = (n: number, rtt: number) => CHALLENGES.filter((c) => c.check(simulate("close", n, rtt), simulate("keepalive", n, rtt))).map((c) => c.id);
  it("are achievable and checked against the run", () => {
    expect(done(1, 50)).toEqual(["tie"]);
    expect(done(40, 100)).toEqual(["win-1s", "save-30", "far-40"]);
    expect(done(10, 50)).toEqual([]);
  });
});
