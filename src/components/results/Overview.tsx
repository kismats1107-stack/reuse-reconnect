import { useMemo, type ReactNode } from "react";
import { ms, pct } from "../../lib/format";
import { breakdown, compare, metricsAt } from "../../lib/metrics";
import { MAX_OBJECTS, RTT_PRESETS, simulate } from "../../lib/simulation";
import { CyberCard } from "../layout/CyberCard";
import { BarChart, ChartCard, Legend, LineChart, StackBars } from "./charts";

const A = { label: "A · New connection", color: "var(--color-chart-cost)", dash: "6 4" };
const B = { label: "B · Keep-Alive", color: "var(--color-chart-lime)" };
const DISTANCE: Record<number, string> = { 0: "same computer", 10: "nearby", 50: "other city", 100: "other country" };

type Props = { objects: number; rttMs: number };

/** KPI tiles and the four model charts for the setting chosen in the hero. */
export function Overview({ objects, rttMs }: Props) {
  const close = useMemo(() => simulate("close", objects, rttMs), [objects, rttMs]);
  const keep = useMemo(() => simulate("keepalive", objects, rttMs), [objects, rttMs]);
  const c = compare(close, keep);
  const mc = metricsAt(close);
  const mk = metricsAt(keep);

  const sweep = useMemo(
    () =>
      Array.from({ length: MAX_OBJECTS }, (_, i) => {
        const n = i + 1;
        const a = simulate("close", n, rttMs);
        const b = simulate("keepalive", n, rttMs);
        return { n, a, b, ma: metricsAt(a), mb: metricsAt(b) };
      }),
    [rttMs],
  );

  const bA = breakdown(close);
  const bB = breakdown(keep);
  const parts = (b: typeof bA) => [
    { key: "hs", label: "Waiting for handshakes", value: b.handshakeMs, color: "var(--color-chart-cost)", striped: true },
    { key: "rq", label: "Asking for files (round trips)", value: b.requestMs, color: "var(--color-chart-cyan)" },
    { key: "tx", label: "Server + sending the bytes", value: b.serverTransferMs, color: "var(--color-chart-neutral)" },
  ];

  return (
    <div className="grid gap-5">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Page load time" big={<><span className="text-cost">{ms(close.loadMs)}</span> <span className="text-faint">→</span> <span className="text-lime">{ms(keep.loadMs)}</span></>} sub="New connection → Keep-Alive" />
        <Kpi label="Time saved" big={ms(c.savedMs)} sub={c.savedPct === null ? "—" : `${pct(c.savedPct)} faster with Keep-Alive`} />
        <Kpi label="Handshakes" big={<><span className="text-cost">{mc.handshakes}</span> <span className="text-faint">→</span> <span className="text-lime">{mk.handshakes}</span></>} sub={`${c.handshakesAvoided} handshake${c.handshakesAvoided === 1 ? "" : "s"} skipped`} />
        <Kpi label="Packets on the wire" big={<><span className="text-cost">{mc.packets}</span> <span className="text-faint">→</span> <span className="text-lime">{mk.packets}</span></>} sub={`${mc.packets - mk.packets} fewer packets`} />
      </div>
      <p className="-mt-1 text-xs text-faint">
        {objects} file{objects === 1 ? "" : "s"}, server {rttMs} ms away ({DISTANCE[rttMs]}). Values from the same simulation that drives the 3D lab.
      </p>

      {/* charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <CyberCard className="p-5">
          <ChartCard title="Page load time vs number of files" sub={`Server ${rttMs} ms away. The gap grows with every file.`} legend={<Legend items={[A, B]} />}>
            <LineChart
              series={[
                { key: "a", ...A, points: sweep.map((s) => ({ x: s.n, y: s.a.loadMs })) },
                { key: "b", ...B, points: sweep.map((s) => ({ x: s.n, y: s.b.loadMs })) },
              ]}
              xTicks={[1, 10, 20, 30, 40]}
              xLabel="files"
              yFormat={ms}
              markX={objects}
              markLabel="selected"
              ariaLabel={`Line chart: with 40 files at ${rttMs} ms, new connections take ${ms(sweep[39].a.loadMs)} and Keep-Alive ${ms(sweep[39].b.loadMs)}.`}
            />
          </ChartCard>
        </CyberCard>

        <CyberCard className="p-5">
          <ChartCard title="Time saved vs server distance" sub={`${objects} files. Farther servers make every handshake more expensive.`}>
            <BarChart
              groups={RTT_PRESETS.map((r) => ({
                label: `${r} ms`,
                values: [{ key: "s", label: "Time saved", value: compare(simulate("close", objects, r), simulate("keepalive", objects, r)).savedMs, color: "var(--color-chart-cyan)" }],
              }))}
              highlight={`${rttMs} ms`}
              yFormat={ms}
              ariaLabel={`Bar chart of time saved by Keep-Alive for ${objects} files at 0, 10, 50 and 100 ms.`}
            />
          </ChartCard>
        </CyberCard>

        <CyberCard className="p-5">
          <ChartCard title="TCP handshakes vs number of files" sub="A pays one handshake per file. B pays one, ever." legend={<Legend items={[A, B]} />}>
            <LineChart
              series={[
                { key: "a", ...A, points: sweep.map((s) => ({ x: s.n, y: s.ma.handshakes })) },
                { key: "b", ...B, points: sweep.map((s) => ({ x: s.n, y: s.mb.handshakes })) },
              ]}
              xTicks={[1, 10, 20, 30, 40]}
              xLabel="files"
              yFormat={(v) => String(Math.round(v))}
              markX={objects}
              ariaLabel="Line chart: handshakes grow one per file with new connections and stay at one with Keep-Alive."
            />
          </ChartCard>
        </CyberCard>

        <CyberCard className="p-5">
          <ChartCard title="Where the load time goes" sub={`${objects} files, ${rttMs} ms. Only the striped part differs between A and B.`}>
            <StackBars
              rows={[
                { label: "A · New connection", total: close.loadMs, parts: parts(bA) },
                { label: "B · Keep-Alive", total: keep.loadMs, parts: parts(bB) },
              ]}
              format={ms}
            />
          </ChartCard>
        </CyberCard>
      </div>
    </div>
  );
}

function Kpi({ label, big, sub }: { label: string; big: ReactNode; sub: string }) {
  return (
    <CyberCard small className="p-4">
      <p className="font-mono text-[0.66rem] uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1.5 font-display text-xl font-semibold tabular-nums leading-tight sm:text-2xl">{big}</p>
      <p className="mt-1 text-xs text-faint">{sub}</p>
    </CyberCard>
  );
}
