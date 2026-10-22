import type { StrategyRun } from "../types/experiment";
import { compare } from "./metrics";

export type Challenge = {
  id: string;
  title: string;
  hint: string;
  check: (close: StrategyRun, keepalive: StrategyRun) => boolean;
};

/** Small goals for free play. Each is checked against a finished "Race both" run. */
export const CHALLENGES: Challenge[] = [
  {
    id: "win-1s",
    title: "Make Keep-Alive win by more than 1 second",
    hint: "More files, or a farther server?",
    check: (c, k) => compare(c, k).savedMs >= 1000,
  },
  {
    id: "tie",
    title: "Find a race that ends in a tie",
    hint: "When is there nothing to reuse?",
    check: (c, k) => c.objects > 0 && Math.abs(compare(c, k).savedMs) < 0.5,
  },
  {
    id: "save-30",
    title: "Skip 30 or more handshakes in one race",
    hint: "Every file after the first saves one.",
    check: (c, k) => compare(c, k).handshakesAvoided >= 30,
  },
  {
    id: "far-40",
    title: "Load all 40 files from a very far server",
    hint: "40 files, 100 ms away.",
    check: (c) => c.objects === 40 && c.rttMs === 100,
  },
];
