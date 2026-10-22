import { BarChart3, Box, Compass, Eye, EyeOff, GraduationCap, Moon, Pause, Play, Sun, Tags } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Captions } from "../components/hud/Captions";
import { ControlDock } from "../components/hud/ControlDock";
import { ResultPanel } from "../components/hud/ResultPanel";
import { Scoreboard } from "../components/hud/Scoreboard";
import { Tour } from "../components/hud/Tour";
import { ResultsPage } from "../components/results/ResultsPage";
import { Scene } from "../components/scene/Scene";
import type { Theme } from "../components/scene/theme";
import { useExperiment, type Run } from "../hooks/useExperiment";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { CHALLENGES } from "../lib/challenges";
import { loadHistory, saveHistory, toRecord, type RunRecord } from "../lib/history";
import type { Strategy } from "../types/experiment";

const TOUR_KEY = "reuse-reconnect:tour-done";
const CHALLENGE_KEY = "reuse-reconnect:challenges";
const THEME_KEY = "reuse-reconnect:theme";

// Browser storage can be unavailable (private windows, blocked site data); the app works without it.
function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* not persisted, still works this session */
  }
}

type Page = "lab" | "results";
const pageFromHash = (): Page => (location.hash === "#/results" ? "results" : "lab");

export function App() {
  const [page, setPage] = useState<Page>(pageFromHash);
  useEffect(() => {
    const onHash = () => {
      setPage(pageFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  // Light / dark theme: tokens switch on <html data-theme>, the 3D scene gets its own palette.
  const [theme, setTheme] = useState<Theme>(() => (load(THEME_KEY) === "light" ? "light" : "dark"));
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#f4f6f9" : "#080b12");
  }, [theme]);
  const toggleTheme = () =>
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      save(THEME_KEY, next);
      return next;
    });

  const go = (p: Page) => {
    location.hash = p === "results" ? "#/results" : "#/lab";
  };

  // Free-play runs are logged for the Results page (tour runs are not).
  const [history, setHistory] = useState<RunRecord[]>(loadHistory);
  const [touring, setTouring] = useState(() => load(TOUR_KEY) !== "1");
  const x = useExperiment({
    onDone: (run) => {
      if (touring || run.endMs === 0) return;
      setHistory((h) => {
        const next = [toRecord(run), ...h];
        saveHistory(next);
        return next;
      });
    },
  });
  const reduced = useReducedMotion();
  const [viewKey, setViewKey] = useState(0);
  // Display toggles: hide the panels to see the whole world, hide labels for a cleaner scene.
  const [panels, setPanels] = useState(true);
  const [labels, setLabels] = useState(true);
  const [dismissed, setDismissed] = useState<Run | null>(null);
  const [solved, setSolved] = useState<Set<string>>(() => new Set(JSON.parse(load(CHALLENGE_KEY) ?? "[]") as string[]));

  // Runs are deterministic, so a race's challenges can be scored the moment it
  // starts; the ticks only become visible in the result panel once it finishes.
  const startRun = () => {
    const run = x.start();
    if (run.close && run.keepalive) {
      const { close, keepalive } = run;
      const next = new Set(solved);
      for (const c of CHALLENGES) if (c.check(close, keepalive)) next.add(c.id);
      if (next.size !== solved.size) {
        setSolved(next);
        save(CHALLENGE_KEY, JSON.stringify([...next]));
      }
    }
  };

  const mode = x.run?.settings.mode ?? x.settings.mode;
  const strategies: Strategy[] = mode === "compare" ? ["close", "keepalive"] : [mode];
  const lanes = strategies.map((s) => ({ strategy: s, run: x.run?.[s] }));
  const live = x.status !== "idle";
  const objects = x.run?.settings.objects ?? x.settings.objects;
  const rtt = x.run?.settings.rttMs ?? x.settings.rttMs;
  // A landed packet glows for ~320 ms of real time, whatever the playback rate.
  const glowMs = x.run ? ((reduced ? 160 : 320) * x.speed) / x.run.realPerSim : 1;
  const showResult = !touring && x.status === "done" && x.run !== null && x.completed === x.run && dismissed !== x.run;

  const exitTour = () => {
    save(TOUR_KEY, "1");
    setTouring(false);
    x.update({ objects: 10, rttMs: 50, mode: "compare" });
  };
  const startTour = () => setTouring(true);

  const topBar = (
    <header className="pointer-events-auto flex flex-wrap items-center gap-x-2 gap-y-2 sm:flex-nowrap sm:gap-3">
      <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" aria-hidden="true">
        <path d="M24 7H8v18h16v-8h-7" fill="none" stroke="var(--color-cyan)" strokeWidth="2.5" strokeLinecap="square" />
        <circle cx="17" cy="17" r="2.2" fill="var(--color-lime)" />
      </svg>
      <div className="hidden min-w-0 sm:block">
        <p className="truncate font-display text-lg font-bold tracking-[0.08em]">
          REUSE <span className="text-faint">/</span> RECONNECT
        </p>
        <p className="hidden truncate font-mono text-[0.68rem] text-muted lg:block">HTTP Keep-Alive vs a new TCP connection per file · Computer Networks lab</p>
      </div>
      <nav aria-label="Pages" className="seg ml-1 w-auto! shrink-0 [&_a]:min-h-9 sm:ml-4">
        {(
          [
            ["lab", "3D Lab", <Box key="i" size={15} aria-hidden="true" />],
            ["results", "Results", <BarChart3 key="i" size={15} aria-hidden="true" />],
          ] as const
        ).map(([p, label, icon]) => (
          <a
            key={p}
            href={p === "results" ? "#/results" : "#/lab"}
            aria-current={page === p ? "page" : undefined}
            className={`flex items-center gap-1.5 border px-3 font-mono text-[0.8rem] ${page === p ? "border-cyan bg-cyan font-semibold text-ink" : "border-line text-muted hover:text-text"}`}
          >
            {icon}
            {label}
          </a>
        ))}
      </nav>
      <div className="ml-auto flex shrink-0 gap-1.5 sm:gap-2">
        <button
          type="button"
          className="btn btn-ghost btn-icon min-h-9! w-9!"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      {page === "lab" && (
        <>
          <Toggle on={panels} onClick={() => setPanels((v) => !v)} label="Panels" onIcon={<Eye size={16} />} offIcon={<EyeOff size={16} />} />
          <Toggle on={labels} onClick={() => setLabels((v) => !v)} label="Labels" onIcon={<Tags size={16} />} offIcon={<Tags size={16} className="opacity-40" />} />
          {!touring && (
            <button type="button" className="btn btn-ghost min-h-9! px-3! text-sm!" onClick={startTour} title="Guided tour">
              <GraduationCap size={16} aria-hidden="true" /> <span className="hidden xl:inline">Guided tour</span>
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-icon min-h-9! w-9!" onClick={() => setViewKey((k) => k + 1)} aria-label="Reset camera view" title="Reset camera view">
            <Compass size={16} />
          </button>
        </>
      )}
      </div>
    </header>
  );

  if (page === "results") {
    return (
      <div className="min-h-dvh bg-ink">
        <div className="atmosphere" aria-hidden="true" />
        <div className="sticky top-0 z-40 border-b border-line bg-ink/95 px-3 py-3 sm:px-5 print:hidden">{topBar}</div>
        <ResultsPage
          objects={x.settings.objects}
          rttMs={x.settings.rttMs}
          history={history}
          solved={solved}
          onClearHistory={() => {
            setHistory([]);
            saveHistory([]);
          }}
          onOpenLab={() => go("lab")}
          reduced={reduced}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-ink">
      <div className="absolute inset-0">
        <Scene lanes={lanes} clock={x.clock} status={x.status} glowMs={glowMs} objects={objects} rttMs={rtt} reduced={reduced} viewKey={viewKey} labels={labels} theme={theme} />
      </div>

      <div className="pointer-events-none absolute inset-0 flex flex-col p-3 sm:p-5">
        {topBar}

        {/* scoreboards */}
        <div className={`mt-3 flex-col gap-2 sm:flex-row sm:justify-between ${panels ? "flex" : "hidden"}`}>
          {lanes.map((l) => (
            <Scoreboard key={l.strategy} strategy={l.strategy} run={l.run} clock={x.clock} live={live} objects={objects} />
          ))}
        </div>

        <div className="relative min-h-0 flex-1">
          {showResult && x.run && (
            <div className="absolute right-0 top-2 max-h-full w-full max-w-sm overflow-y-auto">
              <ResultPanel run={x.run} solved={solved} onClose={() => setDismissed(x.run)} onAgain={() => setDismissed(x.run)} onResults={() => go("results")} />
            </div>
          )}
        </div>

        {/* bottom: tour or captions + controls */}
        <div className="mx-auto grid w-full max-w-6xl gap-2">
          {touring ? (
            <div className="flex justify-center">
              <Tour x={x} onExit={exitTour} />
            </div>
          ) : panels ? (
            <>
              <Captions lanes={lanes} clock={x.clock} live={live} />
              <ControlDock x={x} onStart={startRun} />
            </>
          ) : (
            // panels hidden: just enough to play
            <div className="pointer-events-auto flex justify-center gap-2">
              <button type="button" className="btn btn-primary" onClick={x.status === "running" || x.status === "paused" ? x.togglePause : startRun}>
                {x.status === "running" ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                {x.status === "running" ? "Pause" : x.status === "paused" ? "Resume" : "Start"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setPanels(true)}>
                <Eye size={16} aria-hidden="true" /> Show panels
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** A two-state button in the top bar: the icon and aria-pressed both show its state. */
function Toggle({ on, onClick, label, onIcon, offIcon }: { on: boolean; onClick: () => void; label: string; onIcon: ReactNode; offIcon: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      title={`${on ? "Hide" : "Show"} ${label.toLowerCase()}`}
      className={`btn min-h-9! px-2.5! text-sm! sm:px-3! ${on ? "btn-ghost" : "btn-ghost opacity-70"}`}
    >
      {on ? onIcon : offIcon}
      <span className="hidden md:inline">{label}</span>
      <span aria-hidden="true" className={`ml-0.5 hidden h-4 w-7 sm:inline-flex items-center rounded-full p-0.5 transition-colors ${on ? "bg-cyan" : "bg-line-strong"}`}>
        <span className={`h-3 w-3 rounded-full bg-ink transition-transform ${on ? "translate-x-3" : ""}`} />
      </span>
    </button>
  );
}
