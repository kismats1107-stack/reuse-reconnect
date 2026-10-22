import { Printer } from "lucide-react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { useEffect, useState, type ReactNode } from "react";
import type { RunRecord } from "../../lib/history";
import type { Theme } from "../scene/theme";
import { Overview } from "./Overview";
import { ResultHero } from "./ResultHero";
import { RealMeasurement } from "./RealMeasurement";
import { RunHistory } from "./RunHistory";
import { StudyNotes } from "./StudyNotes";

type Props = {
  objects: number;
  rttMs: number;
  history: RunRecord[];
  solved: Set<string>;
  onClearHistory: () => void;
  onOpenLab: () => void;
  reduced: boolean;
  theme: Theme;
};

/** The Results page: model results, the student's own runs, real measurements, and study notes. */
export function ResultsPage({ objects, rttMs, history, solved, onClearHistory, onOpenLab, reduced, theme }: Props) {
  // Eased, momentum-style scrolling for this long page (off for reduced motion).
  useEffect(() => {
    if (reduced) return;
    const lenis = new Lenis({ autoRaf: true, lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true });
    return () => lenis.destroy();
  }, [reduced]);
  const [n, setN] = useState(objects);
  const [rtt, setRtt] = useState(rttMs);
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className="eyebrow mb-3 flex items-center gap-3">
            <span aria-hidden="true" className="h-px w-8 bg-cyan" /> Experiment 01 · Results
          </p>
          <h1 className="text-4xl font-bold leading-[1.02] sm:text-5xl">
            What the experiment <span className="text-lime">proves.</span>
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            How does reusing a connection change the number of connections, the handshakes, and the time to load a page? Here are the answers: from the model, from your own runs, and from real packets.
          </p>
        </div>
        <button type="button" className="btn btn-ghost print:hidden" onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" /> Save as PDF
        </button>
      </header>

      <ResultHero objects={n} rttMs={rtt} onObjects={setN} onRtt={setRtt} theme={theme} reduced={reduced} />

      <Section index="01" title="At a glance" lead="The same setting in numbers and charts. Change it in the picker above.">
        <Overview objects={n} rttMs={rtt} />
      </Section>

      <Section index="02" title="Your experiments" lead="Races you finished in the 3D lab, and your challenge progress.">
        <RunHistory history={history} solved={solved} onClear={onClearHistory} onOpenLab={onOpenLab} />
      </Section>

      <Section index="03" title="Real proof: Python + Wireshark" lead="Not just a simulation: a real HTTP server and client were run and every packet was captured with Wireshark.">
        <RealMeasurement />
      </Section>

      <Section index="04" title="Study notes" lead="Press play to watch every packet, then flip the cards to check the words.">
        <StudyNotes objects={n} rttMs={rtt} />
      </Section>

      <footer className="mt-16 border-t border-line pt-6 font-mono text-xs text-faint">REUSE / RECONNECT · HTTP Keep-Alive vs New-Connection Requests · Computer Networks</footer>
    </main>
  );
}

function Section({ index, title, lead, children }: { index: string; title: string; lead: string; children: ReactNode }) {
  return (
    <section className="mt-14 first-of-type:mt-0 print:break-inside-avoid-page" aria-labelledby={`sec-${index}`}>
      <div className="mb-5">
        <p className="eyebrow mb-2 flex items-center gap-3">
          <span className="text-cyan">{index}</span>
          <span aria-hidden="true" className="h-px w-8 bg-line-strong" />
        </p>
        <h2 id={`sec-${index}`} className="text-2xl font-semibold sm:text-3xl">
          {title}
        </h2>
        <p className="mt-1.5 text-muted">{lead}</p>
      </div>
      {children}
    </section>
  );
}
