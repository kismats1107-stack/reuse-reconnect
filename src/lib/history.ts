import type { Run } from "../hooks/useExperiment";
import type { RunMode, StrategyRun } from "../types/experiment";
import { metricsAt } from "./metrics";

export type LaneRecord = { loadMs: number; connections: number; handshakes: number; packets: number };
export type RunRecord = { at: string; mode: RunMode; objects: number; rttMs: number; close?: LaneRecord; keepalive?: LaneRecord };

const KEY = "reuse-reconnect:history";
const MAX = 50;

const lane = (r?: StrategyRun): LaneRecord | undefined => {
  if (!r) return undefined;
  const m = metricsAt(r);
  return { loadMs: r.loadMs, connections: m.connections, handshakes: m.handshakes, packets: m.packets };
};

export function toRecord(run: Run): RunRecord {
  const { mode, objects, rttMs } = run.settings;
  return { at: new Date().toISOString(), mode, objects, rttMs, close: lane(run.close), keepalive: lane(run.keepalive) };
}

// Browser storage may be unavailable (private windows, blocked site data); history then lasts for this visit only.
export function loadHistory(): RunRecord[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? (raw as RunRecord[]).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(list: RunRecord[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* kept in memory only */
  }
}
