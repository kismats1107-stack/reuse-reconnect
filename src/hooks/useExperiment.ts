import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { simulate } from "../lib/simulation";
import type { ExperimentSettings, StrategyRun } from "../types/experiment";

export type Status = "idle" | "running" | "paused" | "done";
export type Speed = 0.25 | 0.5 | 1 | 2;

export type Run = {
  settings: ExperimentSettings;
  close?: StrategyRun;
  keepalive?: StrategyRun;
  /** Simulated ms at which the last packet of every played strategy has landed. */
  endMs: number;
  /** Real (wall-clock) ms of playback per simulated ms, at 1× speed. */
  realPerSim: number;
};

/**
 * Picks a playback rate: one RTT should take about 0.8 s on screen, but the
 * whole run is kept between 3 s and 14 s. Both lanes share one clock, so the
 * race between strategies stays proportional.
 */
export function playbackRate(endMs: number, rttMs: number): number {
  if (endMs <= 0) return 1;
  const desired = rttMs > 0 ? endMs * (800 / rttMs) : 4500;
  return Math.min(14000, Math.max(3000, desired)) / endMs;
}

export function buildRun(settings: ExperimentSettings): Run {
  const close = settings.mode !== "keepalive" ? simulate("close", settings.objects, settings.rttMs) : undefined;
  const keepalive = settings.mode !== "close" ? simulate("keepalive", settings.objects, settings.rttMs) : undefined;
  const endMs = Math.max(close?.endMs ?? 0, keepalive?.endMs ?? 0);
  return { settings, close, keepalive, endMs, realPerSim: playbackRate(endMs, settings.rttMs) };
}

/**
 * Owns the experiment: settings, the generated run, and one playback clock in
 * simulated milliseconds. A single requestAnimationFrame loop advances the
 * clock; it is torn down on pause, reset, settings change and unmount, so two
 * runs can never overlap. `playTo` lets the guided tour play up to a chosen
 * moment and pause there.
 */
export function useExperiment(opts: { onDone?: (run: Run) => void } = {}) {
  const [settings, setSettings] = useState<ExperimentSettings>({ objects: 10, rttMs: 50, mode: "compare" });
  const [run, setRun] = useState<Run | null>(null);
  const [completed, setCompleted] = useState<Run | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [clock, setClockState] = useState(0);
  const [speed, setSpeed] = useState<Speed>(1);

  // The rAF loop reads the clock synchronously; keep a ref in step with state.
  const clockRef = useRef(0);
  const stopAt = useRef<number | null>(null);
  const setClock = useCallback((t: number) => {
    clockRef.current = t;
    setClockState(t);
  }, []);

  // Called once each time a run reaches its end (used to log runs for the Results page).
  const onDone = useRef(opts.onDone);
  useEffect(() => {
    onDone.current = opts.onDone;
  });
  const complete = useCallback((r: Run) => {
    setStatus("done");
    setCompleted(r);
    onDone.current?.(r);
  }, []);

  useEffect(() => {
    if (status !== "running" || !run) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(200, now - last); // a background tab must not jump the run to the end
      last = now;
      const next = clockRef.current + (dt * speed) / run.realPerSim;
      const stop = stopAt.current;
      if (next >= run.endMs) {
        stopAt.current = null;
        setClock(run.endMs);
        complete(run);
        return;
      }
      if (stop !== null && next >= stop) {
        stopAt.current = null;
        setClock(stop);
        setStatus("paused");
        return;
      }
      setClock(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [status, run, speed, setClock, complete]);

  const update = useCallback(
    (patch: Partial<ExperimentSettings>) => {
      setSettings((s) => ({ ...s, ...patch }));
      // A run always belongs to the settings it was generated from.
      stopAt.current = null;
      setRun(null);
      setStatus("idle");
      setClock(0);
    },
    [setClock],
  );

  /** Generates a run and plays it, or holds it at t = 0 when `paused`. */
  const start = useCallback(
    (override?: ExperimentSettings, opts: { paused?: boolean } = {}) => {
      const s = override ?? settings;
      if (override) setSettings(override);
      const next = buildRun(s);
      stopAt.current = null;
      setRun(next);
      setClock(0);
      if (next.endMs === 0) {
        complete(next);
      } else {
        setStatus(opts.paused ? "paused" : "running");
      }
      return next;
    },
    [settings, setClock, complete],
  );

  /** Plays from the current moment up to `t` (simulated ms), then pauses. */
  const playTo = useCallback(
    (t: number) => {
      if (!run) return;
      if (t <= clockRef.current + 1e-9) {
        setClock(Math.max(clockRef.current, t));
        return;
      }
      stopAt.current = t;
      setStatus("running");
    },
    [run, setClock],
  );

  const replay = useCallback(() => {
    if (!run) return;
    stopAt.current = null;
    setClock(0);
    setStatus(run.endMs === 0 ? "done" : "running");
  }, [run, setClock]);

  const togglePause = useCallback(() => {
    stopAt.current = null;
    setStatus((s) => (s === "running" ? "paused" : s === "paused" ? "running" : s));
  }, []);

  const reset = useCallback(() => {
    stopAt.current = null;
    setRun(null);
    setStatus("idle");
    setClock(0);
  }, [setClock]);

  /** Plays smoothly to the next moment a packet leaves or lands, then pauses. */
  const step = useCallback(() => {
    if (!run) return;
    const t = clockRef.current;
    let next = run.endMs;
    for (const r of [run.close, run.keepalive]) {
      for (const e of r?.events ?? []) {
        if (e.timeMs > t + 1e-6 && e.timeMs < next) next = e.timeMs;
        if (e.arriveMs > t + 1e-6 && e.arriveMs < next) next = e.arriveMs;
      }
    }
    playTo(next);
  }, [run, playTo]);

  const finish = useCallback(() => {
    if (!run) return;
    stopAt.current = null;
    setClock(run.endMs);
    complete(run);
  }, [run, setClock, complete]);

  return useMemo(
    () => ({ settings, update, run, completed, status, clock, speed, setSpeed, start, playTo, replay, togglePause, reset, step, finish }),
    [settings, update, run, completed, status, clock, speed, start, playTo, replay, togglePause, reset, step, finish],
  );
}

export type Experiment = ReturnType<typeof useExperiment>;
