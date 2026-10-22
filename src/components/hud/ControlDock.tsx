import { Pause, Play, RotateCcw, SlidersHorizontal, StepForward } from "lucide-react";
import { useState } from "react";
import type { Experiment, Speed } from "../../hooks/useExperiment";
import { MAX_OBJECTS } from "../../lib/simulation";
import type { RunMode } from "../../types/experiment";
import { CyberCard } from "../layout/CyberCard";
import { Legend } from "./Legend";

const MODES: { value: RunMode; label: string; short: string }[] = [
  { value: "compare", label: "⚔ Race both", short: "Race" },
  { value: "close", label: "New connection", short: "New conn." },
  { value: "keepalive", label: "Keep-Alive", short: "Keep-Alive" },
];
const DISTANCES = [
  { rtt: 0, label: "Same computer", ms: "0 ms" },
  { rtt: 10, label: "Nearby", ms: "10 ms" },
  { rtt: 50, label: "Other city", ms: "50 ms" },
  { rtt: 100, label: "Other country", ms: "100 ms" },
];
const FILE_PRESETS = [1, 5, 10, 20, 40];
const SPEEDS: Speed[] = [0.25, 0.5, 1, 2];

/** Everything a student can change, in one bar at the bottom of the screen. */
export function ControlDock({ x, onStart }: { x: Experiment; onStart: () => void }) {
  const { settings, status, run } = x;
  // Phones start with settings folded so the 3D world stays visible.
  const [open, setOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 640);
  const live = status === "running" || status === "paused";
  const startLabel = status === "idle" ? (settings.mode === "compare" ? "Start race" : "Load page") : "Run again";

  return (
    <CyberCard className="pointer-events-auto w-full backdrop-blur-md">
      {/* main row: always visible */}
      <div className="flex flex-wrap items-center gap-2 p-3 sm:gap-3 sm:px-5">
        <button type="button" className="btn btn-primary min-w-[9.5rem]" onClick={onStart}>
          <Play size={16} aria-hidden="true" /> {startLabel}
        </button>
        <button type="button" className="btn btn-ghost btn-icon" onClick={x.togglePause} disabled={!live} aria-label={status === "paused" ? "Resume" : "Pause"} title={status === "paused" ? "Resume" : "Pause"}>
          {status === "paused" ? <Play size={16} /> : <Pause size={16} />}
        </button>
        <button type="button" className="btn btn-ghost btn-icon" onClick={x.step} disabled={!run || status === "done"} aria-label="Next packet" title="Next packet (step)">
          <StepForward size={16} />
        </button>
        <button type="button" className="btn btn-ghost btn-icon" onClick={x.replay} disabled={!run || status === "running"} aria-label="Replay" title="Replay">
          <RotateCcw size={16} />
        </button>
        <div className="seg ml-1 hidden sm:flex [&_button]:min-h-9! [&_button]:min-w-0! [&_button]:px-2!" role="radiogroup" aria-label="Speed">
          {SPEEDS.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={x.speed === s} onClick={() => x.setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
        <Legend className="ml-auto hidden xl:flex" />
        <button type="button" className="btn btn-ghost ml-auto min-h-10! px-3! text-sm! lg:hidden" aria-expanded={open} aria-controls="dock-settings" onClick={() => setOpen((v) => !v)}>
          <SlidersHorizontal size={15} aria-hidden="true" /> Settings
        </button>
      </div>

      {/* settings */}
      <div id="dock-settings" className={`${open ? "grid" : "hidden"} gap-4 border-t border-line p-3 sm:px-5 lg:grid! lg:grid-cols-[1.1fr_1.3fr_1.4fr] lg:gap-6`}>
        <fieldset>
          <legend className="eyebrow mb-1.5 text-[0.66rem]!">What to do</legend>
          <div className="seg" role="radiogroup" aria-label="What to do">
            {MODES.map((m) => (
              <button key={m.value} type="button" role="radio" aria-checked={settings.mode === m.value} onClick={() => x.update({ mode: m.value })}>
                <span className="hidden xl:inline">{m.label}</span>
                <span className="xl:hidden">{m.short}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="eyebrow mb-1.5 flex w-full items-center justify-between text-[0.66rem]!">
            <span>Files on the web page</span>
            <output htmlFor="files" className="font-display text-base font-semibold text-text">
              {settings.objects}
            </output>
          </legend>
          <div className="flex items-center gap-3">
            <input
              id="files"
              type="range"
              min={1}
              max={MAX_OBJECTS}
              value={settings.objects}
              onChange={(e) => x.update({ objects: Number(e.target.value) })}
              className="range min-w-0 flex-1"
              style={{ ["--fill" as string]: `${((settings.objects - 1) / (MAX_OBJECTS - 1)) * 100}%` }}
              aria-label="Number of files"
            />
            <div className="seg shrink-0 [&_button]:min-h-8! [&_button]:min-w-0! [&_button]:px-2!" role="group" aria-label="File presets">
              {FILE_PRESETS.map((n) => (
                <button key={n} type="button" aria-pressed={settings.objects === n} onClick={() => x.update({ objects: n })}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className="eyebrow mb-1.5 text-[0.66rem]!">How far away is the server?</legend>
          <div className="seg" role="radiogroup" aria-label="Server distance (round-trip time)">
            {DISTANCES.map((d) => (
              <button key={d.rtt} type="button" role="radio" aria-checked={settings.rttMs === d.rtt} onClick={() => x.update({ rttMs: d.rtt })} className="leading-tight">
                <span className="block font-sans text-[0.72rem]">{d.label}</span>
                <span className="block text-[0.66rem] opacity-80">{d.ms}</span>
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </CyberCard>
  );
}
