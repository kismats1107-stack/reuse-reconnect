import { useState, type ReactNode } from "react";
import { ms } from "../../lib/format";
import { breakdown } from "../../lib/metrics";
import { simulate } from "../../lib/simulation";
import { CyberCard } from "../layout/CyberCard";
import { SequenceDiagrams } from "./SequenceDiagram";

const TAKEAWAYS = [
  { big: "1 RTT", text: "is what every TCP handshake costs before a file can move" },
  { big: "N", text: "handshakes with Connection: close, one per file" },
  { big: "1", text: "handshake with Keep-Alive, shared by every file" },
  { big: "(N−1)·RTT", text: "is the time Keep-Alive saves" },
];

const GLOSSARY: [string, string][] = [
  ["TCP connection", "A reliable two-way channel between browser and server. Must be opened before HTTP can use it."],
  ["Handshake", "The 3 packets that open a connection: SYN, SYN-ACK, ACK."],
  ["SYN", "“Can we connect?” The browser's first packet."],
  ["SYN-ACK", "“Yes, ready.” The server's reply."],
  ["ACK", "“Great, connected.” Data may now flow."],
  ["GET / 200 OK", "The request for one file, and the reply that carries it."],
  ["FIN", "Closes a connection. With Connection: close, after every file."],
  ["RTT", "Round-trip time: there and back again for one packet."],
  ["Keep-Alive", "Reusing one open connection for many requests (HTTP/1.1 default)."],
];

/** Takeaways, animated sequence diagrams, a live formula and flip-card glossary. */
export function StudyNotes({ objects, rttMs }: { objects: number; rttMs: number }) {
  return (
    <div className="grid gap-4">
      <CyberCard className="p-5">
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TAKEAWAYS.map((t) => (
            <li key={t.big} className="border-l-2 border-cyan/60 pl-3">
              <p className="font-display text-2xl font-semibold text-text">{t.big}</p>
              <p className="mt-0.5 text-sm leading-snug text-muted">{t.text}</p>
            </li>
          ))}
        </ul>
      </CyberCard>

      <SequenceDiagrams />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <FormulaCalc objects={objects} rttMs={rttMs} />
        <Glossary />
      </div>
    </div>
  );
}

/** A value in the formula: N in blue, RTT in orange, results in plain text. */
function V({ children, tone }: { children: ReactNode; tone?: "n" | "r" }) {
  return <b className={`font-semibold ${tone === "n" ? "text-cyan" : tone === "r" ? "text-cost" : "text-text"}`}>{children}</b>;
}

/** The formulas with the page's current setting plugged in. */
function FormulaCalc({ objects: n, rttMs: rtt }: { objects: number; rttMs: number }) {
  const close = simulate("close", n, rtt);
  const keep = simulate("keepalive", n, rtt);
  const extra = breakdown(close).serverTransferMs;
  return (
    <CyberCard className="p-5" tone="lime">
      <p className="font-display text-lg font-semibold">The formula, with your numbers</p>
      <p className="mb-4 mt-1 text-sm text-muted">
        N = <V tone="n">{n}</V> files, RTT = <V tone="r">{rtt} ms</V>. Change them at the top of the page.
      </p>
      <div className="grid gap-3 font-mono text-[0.82rem] leading-relaxed">
        <p className="overflow-x-auto whitespace-nowrap">
          <span className="text-cost">A</span> = N × 2·RTT + extra
          <br />
          <span className="text-faint">&nbsp;&nbsp;= </span>
          <V tone="n">{n}</V> × 2·<V tone="r">{rtt}</V> + {ms(extra)} = <V>{ms(close.loadMs)}</V>
        </p>
        <p className="overflow-x-auto whitespace-nowrap">
          <span className="text-lime">B</span> = RTT + N × RTT + extra
          <br />
          <span className="text-faint">&nbsp;&nbsp;= </span>
          <V tone="r">{rtt}</V> + <V tone="n">{n}</V> × <V tone="r">{rtt}</V> + {ms(extra)} = <V>{ms(keep.loadMs)}</V>
        </p>
        <p className="overflow-x-auto whitespace-nowrap border-t border-line pt-3 text-[0.95rem]">
          Saved = (N − 1) × RTT = (<V tone="n">{n}</V> − 1) × <V tone="r">{rtt}</V> = <b className="text-lime">{ms(close.loadMs - keep.loadMs)}</b>
        </p>
      </div>
      <p className="mt-3 text-xs text-faint">“extra” = server time + sending the bytes. It is the same for A and B, so it cancels out.</p>
    </CyberCard>
  );
}

/** Tap a term to flip it over. */
function Glossary() {
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setFlipped((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  return (
    <CyberCard className="p-5">
      <p className="font-display text-lg font-semibold">Glossary</p>
      <p className="mb-4 mt-1 text-sm text-muted">Tap a card to flip it.</p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {GLOSSARY.map(([k, v]) => (
          <button key={k} type="button" aria-pressed={flipped.has(k)} onClick={() => toggle(k)} className="flip h-28 text-left" aria-label={flipped.has(k) ? `${k}: ${v}` : `${k}, show meaning`}>
            <span className="flip-inner">
              <span className="flip-face border border-line-strong bg-raised">
                <span className="font-mono text-sm font-semibold text-cyan">{k}</span>
                <span className="mt-auto font-mono text-[0.62rem] uppercase tracking-wider text-faint">tap to flip</span>
              </span>
              <span className="flip-face flip-back border border-cyan/50 bg-surface">
                <span className="text-[0.8rem] leading-snug text-text">{v}</span>
              </span>
            </span>
          </button>
        ))}
      </div>
    </CyberCard>
  );
}
