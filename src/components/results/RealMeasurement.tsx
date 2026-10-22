import { useState } from "react";
import data from "../../data/measurement.json";
import { ms } from "../../lib/format";
import { simulate } from "../../lib/simulation";
import { CyberCard } from "../layout/CyberCard";
import { ChartCard, Legend, LineChart } from "./charts";

type Sample = { loadMs: number; clientConnections: number; serverConnections: number; captureConnections?: number; captureHandshakes?: number };
type MRun = { objects: number; rttMs: number; rttMode: string; strategy: "close" | "keepalive"; repetitions: number; loadMs: { median: number }; samples: Sample[] };

const runs = data.runs as MRun[];
const RTTS = [...new Set(runs.map((r) => r.rttMs))].sort((a, b) => a - b);
const NS = [...new Set(runs.map((r) => r.objects))].sort((a, b) => a - b);
const get = (s: "close" | "keepalive", n: number, rtt: number) => runs.find((r) => r.strategy === s && r.objects === n && r.rttMs === rtt)!;
const trials = runs.reduce((a, r) => a + r.samples.length, 0);
const countsAgree = runs.every((r) =>
  r.samples.every((s) => {
    const want = r.strategy === "close" ? r.objects : 1;
    return s.clientConnections === want && s.serverConnections === want && s.captureConnections === want && s.captureHandshakes === want;
  }),
);

/**
 * Real measurements from the Python lab (lab/run_experiment.py): a real
 * HTTP/1.1 server and client, packets captured with Wireshark's dumpcap.
 */
export function RealMeasurement() {
  const [rtt, setRtt] = useState(RTTS.includes(50) ? 50 : RTTS[RTTS.length - 1]);
  const [open, setOpen] = useState(false);
  const model = (s: "close" | "keepalive") => NS.map((n) => ({ x: n, y: simulate(s, n, rtt).loadMs }));
  const measured = (s: "close" | "keepalive") => NS.map((n) => ({ x: n, y: get(s, n, rtt).loadMs.median }));
  const emulated = rtt > 0;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Fact big={String(trials)} label="real trials" sub={`${NS.length} page sizes × ${RTTS.length} distances × 2 ways × ${runs[0].repetitions}`} />
        <Fact big={countsAgree ? "3 / 3" : "check"} label="counters agree" sub="client sockets, server accepts and Wireshark SYN packets" good={countsAgree} />
        <Fact big="Wireshark" label="packet capture" sub={`${(data.capture as { tool?: string }).tool?.split(" (")[0] ?? "dumpcap"} on the loopback adapter`} />
        <Fact big={new Date(data.generatedAt).toLocaleDateString()} label="recorded" sub={`${data.host.os} · Python ${data.host.python}`} />
      </div>

      <div className={`grid gap-4 ${open ? "lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" : ""}`}>
        <CyberCard className="p-5">
          <ChartCard
            title="Measured vs model"
            sub={
              <>
                Dots are real medians, lines are the model. {emulated ? <>Server distance {rtt} ms is <b className="text-text">emulated</b> by a relay that delays packets on this laptop.</> : <>0 ms = plain loopback, no added delay.</>}
              </>
            }
            legend={
              <Legend
                items={[
                  { label: "A model", color: "var(--color-chart-cost)", dash: "6 4" },
                  { label: "A measured", color: "var(--color-chart-cost)", dot: true },
                  { label: "B model", color: "var(--color-chart-lime)", dash: "6 4" },
                  { label: "B measured", color: "var(--color-chart-lime)", dot: true },
                ]}
              />
            }
          >
            <div className="seg mb-1 w-fit [&_button]:min-h-8! [&_button]:min-w-14! [&_button]:whitespace-nowrap" role="radiogroup" aria-label="Server distance">
              {RTTS.map((r) => (
                <button key={r} type="button" role="radio" aria-checked={rtt === r} onClick={() => setRtt(r)}>
                  {r} ms
                </button>
              ))}
            </div>
            <LineChart
              series={[
                { key: "am", label: "A model", color: "var(--color-chart-cost)", dash: "6 4", points: model("close") },
                { key: "bm", label: "B model", color: "var(--color-chart-lime)", dash: "6 4", points: model("keepalive") },
                { key: "a", label: "A measured", color: "var(--color-chart-cost)", points: measured("close"), dots: true, noLine: true },
                { key: "b", label: "B measured", color: "var(--color-chart-lime)", points: measured("keepalive"), dots: true, noLine: true },
              ]}
              xTicks={NS}
              xLabel="files"
              yFormat={ms}
              ariaLabel={`Measured and modelled load times at ${rtt} ms for ${NS.join(", ")} files.`}
            />
            <button type="button" className="mt-1 w-fit font-mono text-xs text-cyan underline-offset-4 hover:underline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              {open ? "Hide the numbers" : "Show the numbers →"}
            </button>
          </ChartCard>
        </CyberCard>

        {open && (
        <CyberCard className="p-5">
          <p className="mb-3 font-display text-lg font-semibold">Measured medians · {rtt} ms</p>
          <table className="w-full border-collapse font-mono text-[0.8rem]">
            <thead>
              <tr className="border-b border-line text-left text-[0.66rem] uppercase tracking-wider text-muted">
                <th className="py-2 font-normal">Files</th>
                <th className="py-2 text-right font-normal text-cost">A</th>
                <th className="py-2 text-right font-normal text-lime">B</th>
                <th className="py-2 text-right font-normal">Saved</th>
                <th className="py-2 text-right font-normal">Conns A/B</th>
              </tr>
            </thead>
            <tbody>
              {NS.map((n) => {
                const a = get("close", n, rtt);
                const b = get("keepalive", n, rtt);
                return (
                  <tr key={n} className="border-b border-line/60">
                    <td className="py-2">{n}</td>
                    <td className="py-2 text-right">{ms(a.loadMs.median)}</td>
                    <td className="py-2 text-right">{ms(b.loadMs.median)}</td>
                    <td className="py-2 text-right font-semibold text-text">{ms(a.loadMs.median - b.loadMs.median)}</td>
                    <td className="py-2 text-right">
                      {a.samples[0].captureConnections}/{b.samples[0].captureConnections}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs leading-relaxed text-faint">
            Median of {runs[0].repetitions} runs each. “Conns” are counted from the SYN packets Wireshark captured. Capture file: <code className="text-muted">evidence/</code>
          </p>
        </CyberCard>
        )}
      </div>
    </div>
  );
}

function Fact({ big, label, sub, good }: { big: string; label: string; sub: string; good?: boolean }) {
  return (
    <CyberCard small className="p-4" tone={good ? "lime" : "default"}>
      <p className={`font-display text-2xl font-semibold leading-tight ${good ? "text-lime" : "text-text"}`}>{big}</p>
      <p className="mt-0.5 font-mono text-[0.66rem] uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-xs text-faint">{sub}</p>
    </CyberCard>
  );
}
