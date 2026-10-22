import { CyberCard } from "../layout/CyberCard";
import { SequenceDiagrams } from "./SequenceDiagram";

const TAKEAWAYS = [
  { n: "01", title: "A handshake costs a round trip", body: "Every new TCP connection starts with SYN → SYN-ACK → ACK. No file can move until it is done, so each handshake wastes one RTT." },
  { n: "02", title: "Connection: close = N handshakes", body: "When the server closes after every file, a page with N files needs N connections and N handshakes." },
  { n: "03", title: "Keep-Alive = 1 handshake", body: "HTTP/1.1 keeps the connection open by default, so all N files share one connection and one handshake." },
  { n: "04", title: "Saving ≈ (N − 1) × RTT", body: "More files or a farther server means a bigger win. With 1 file, or a server at 0 ms, there is nothing to save." },
];

const GLOSSARY: [string, string][] = [
  ["TCP connection", "A reliable two-way channel between browser and server. Must be opened before HTTP can use it."],
  ["Handshake", "The 3 packets that open a TCP connection: SYN, SYN-ACK, ACK."],
  ["SYN", "“Can we connect?” The browser's first packet."],
  ["SYN-ACK", "“Yes, ready.” The server's reply."],
  ["ACK", "“Great, connected.” Confirms; data may now flow."],
  ["GET / 200 OK", "The HTTP request for one file, and the server's reply carrying it."],
  ["FIN", "Closes a connection. With Connection: close this happens after every file."],
  ["RTT", "Round-trip time: how long a packet takes to reach the server and come back."],
  ["Keep-Alive", "Reusing one open connection for many requests (HTTP/1.1 default)."],
];

/** Key takeaways, step-by-step sequence diagrams, formulas and a glossary. */
export function StudyNotes() {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TAKEAWAYS.map((t) => (
          <CyberCard key={t.n} interactive className="p-5" index={t.n}>
            <p className="pr-8 font-display text-lg font-semibold leading-tight">{t.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t.body}</p>
          </CyberCard>
        ))}
      </div>

      <SequenceDiagrams />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <CyberCard className="p-5">
          <p className="mb-4 font-display text-lg font-semibold">Formulas</p>
          <div className="grid gap-3 font-mono text-sm">
            <p className="overflow-x-auto whitespace-nowrap">
              <span className="text-cost">T(close)</span> = N × 2·RTT + Σ(server + transfer)
            </p>
            <p className="overflow-x-auto whitespace-nowrap">
              <span className="text-lime">T(keep-alive)</span> = RTT + N × RTT + Σ(server + transfer)
            </p>
            <p className="border-t border-line pt-3 text-base text-text">Saving = (N − 1) × RTT</p>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-faint">N = number of files. Requests are one after another. The Σ part is the same for both, so it cancels out in the saving.</p>
        </CyberCard>
        <CyberCard className="p-5">
          <p className="mb-4 font-display text-lg font-semibold">Glossary</p>
          <dl className="grid gap-x-5 gap-y-2.5 sm:grid-cols-[8rem_1fr]">
            {GLOSSARY.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-mono text-xs font-semibold text-cyan sm:pt-0.5">{k}</dt>
                <dd className="m-0 text-sm text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </CyberCard>
      </div>

    </div>
  );
}
