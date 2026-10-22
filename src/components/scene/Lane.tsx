import { memo, useMemo, type ReactNode } from "react";
import { connState, connectionTimes } from "../../lib/connections";
import { ms } from "../../lib/format";
import { metricsAt } from "../../lib/metrics";
import { fileName } from "../../lib/narration";
import { ASSETS } from "../../lib/simulation";
import type { Status } from "../../hooks/useExperiment";
import type { Strategy, StrategyRun } from "../../types/experiment";
import { Browser, Server } from "./Buildings";
import { Cable } from "./Cable";
import { FloorLine } from "./FloorLine";
import { BROWSER_X, RAIL, packetKind } from "./layout";
import { useColors } from "./theme";
import { Label } from "./Label";
import { PacketMesh } from "./PacketMesh";

type Props = {
  strategy: Strategy;
  run?: StrategyRun;
  z: number;
  clock: number;
  status: Status;
  /** Simulated ms a landed packet keeps glowing at its destination. */
  glowMs: number;
  objects: number;
  rttMs: number;
  reduced: boolean;
  labels: boolean;
};

const IDLE_WIRE: [number, number, number][] = [
  [RAIL.x0, (RAIL.up + RAIL.down) / 2, 0],
  [RAIL.x1, (RAIL.up + RAIL.down) / 2, 0],
];
const BORDER: [number, number, number][] = [
  [-9.75, 0.01, -2.8],
  [9.75, 0.01, -2.8],
  [9.75, 0.01, 2.8],
  [-9.75, 0.01, 2.8],
  [-9.75, 0.01, -2.8],
];
const NETWORK_PATH: [number, number, number][] = [
  [RAIL.x0, 0.02, 1.1],
  [RAIL.x1, 0.02, 1.1],
];

const TITLE: Record<Strategy, string> = {
  close: "A · NEW CONNECTION FOR EVERY FILE",
  keepalive: "B · KEEP-ALIVE: ONE CONNECTION, REUSED",
};

/**
 * One complete world for one strategy: browser, server, the connections
 * between them, packets in flight, and a pile of used-up connections. Every
 * object here is computed from the run's events at the current clock.
 */
export function Lane({ strategy, run, z, clock: t, status, glowMs, objects, rttMs, reduced, labels }: Props) {
  const COLOR = useColors();
  const conns = useMemo(() => (run ? connectionTimes(run.events) : []), [run]);
  const live = run && status !== "idle";
  const m = run && live ? metricsAt(run, t) : null;

  // Packets on the wire, plus a short afterglow once they land.
  const packets: ReactNode[] = [];
  let browserPulse = 0;
  let serverPulse = 0;
  if (run && live) {
    const rows = { up: [] as number[][], down: [] as number[][] };
    for (const e of run.events) {
      if (e.timeMs > t) break;
      if (e.type === "CONNECTION_REUSE") continue;
      const toServer = e.direction === "client-to-server";
      if (e.arriveMs <= t && t - e.arriveMs < glowMs) {
        const p = 1 - (t - e.arriveMs) / glowMs;
        if (toServer) serverPulse = Math.max(serverPulse, p);
        else browserPulse = Math.max(browserPulse, p);
      }
      if (t > e.arriveMs + glowMs) continue;
      const f = e.arriveMs > e.timeMs ? Math.min(1, (t - e.timeMs) / (e.arriveMs - e.timeMs)) : 1;
      const pad = 0.5;
      const x = toServer ? RAIL.x0 + pad + f * (RAIL.x1 - RAIL.x0 - 2 * pad) : RAIL.x1 - pad - f * (RAIL.x1 - RAIL.x0 - 2 * pad);
      // packets that travel together (ACK + GET) stack instead of overlapping
      const track = toServer ? rows.up : rows.down;
      let row = 0;
      while (row < 3 && (track[row] ?? []).some((o) => Math.abs(o - x) < 0.9)) row++;
      (track[row] ??= []).push(x);
      const y = toServer ? RAIL.up + row * 0.75 : RAIL.down - row * 0.75;
      const kind = packetKind(e);
      const opacity = t > e.arriveMs ? Math.max(0, 1 - (t - e.arriveMs) / glowMs) : 1;
      const size = kind === "response" ? 0.75 + 0.6 * Math.sqrt(ASSETS[e.objectIndex ?? 0].bytes / ASSETS[5].bytes) : 1;
      const label =
        e.type === "HTTP_REQUEST" ? `GET ${fileName(e)}` : e.type === "HTTP_RESPONSE" ? fileName(e) : e.type === "SYN_ACK" ? "SYN-ACK" : e.label;
      packets.push(
        <PacketMesh key={e.id} kind={kind} label={label} position={[x, y, 0]} opacity={opacity} size={size} showLabel={labels} spin={!reduced} />,
      );
    }
  }

  // Closed connections drop onto a pile next to the browser: one block each.
  const closed = live ? conns.filter((c) => connState(c, t) === "closed") : [];
  const pile = closed.map((c, i) => {
    const fall = Math.min(1, (t - c.closed) / (glowMs * 2));
    const col = i % 5;
    const row = Math.floor(i / 5);
    const y = 0.16 + row * 0.3;
    return (
      <mesh key={c.id} position={[BROWSER_X - 1.2 + col * 0.34, y + (1 - fall) * 1.6, 2.05]}>
        <boxGeometry args={[0.28, 0.26, 0.28]} />
        <meshStandardMaterial color={COLOR.muted} emissive={COLOR.muted} emissiveIntensity={0.15} />
      </mesh>
    );
  });

  const loaded = run && live && t >= run.loadMs;
  const reuses = m?.reuses ?? 0;

  return (
    <group position={[0, 0, z]}>
      <LaneStatic strategy={strategy} rttMs={rttMs} />

      {/* before a run: an empty path, no connection yet */}
      {!live && <FloorLine points={IDLE_WIRE} color={COLOR.muted} opacity={0.6} dash={[0.12, 0.22]} />}

      {live && conns.map((c) => <Cable key={c.id} conn={c} t={t} reuses={strategy === "keepalive" ? reuses : 0} label={labels} />)}
      {packets}

      <Browser
        z={0}
        pulse={browserPulse}
        filesDone={m?.requests ?? 0}
        filesTotal={run?.objects ?? objects}
        loadedText={loaded ? `page loaded · ${ms(run!.loadMs)}` : undefined}
      />
      <Server z={0} pulse={serverPulse} served={m?.requests ?? 0} />

      {pile}
      {closed.length > 0 && (
        <Label
          text={`${closed.length} used connection${closed.length === 1 ? "" : "s"}`}
          position={[BROWSER_X - 0.5, 0.45 + Math.ceil(closed.length / 5) * 0.3, 2.05]}
          size={0.22}
          color={COLOR.text}
          bg={COLOR.ink}
          border={COLOR.muted}
        />
      )}
    </group>
  );
}

/**
 * The parts of a lane that never move: floor, border, title and the network
 * path. Memoised so the per-frame clock does not re-render them.
 */
const LaneStatic = memo(function LaneStatic({ strategy, rttMs }: { strategy: Strategy; rttMs: number }) {
  const COLOR = useColors();
  const color = strategy === "close" ? COLOR.cost : COLOR.lime;
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[19.5, 5.6]} />
        <meshBasicMaterial color={color} transparent opacity={0.025} depthWrite={false} />
      </mesh>
      <FloorLine points={BORDER} color={color} opacity={0.35} />
      {/* the lane's name floats above it */}
      <Label text={TITLE[strategy]} position={[0, 3.7, -1.0]} size={0.36} color={color} bg={COLOR.ink} border={color} />
      {/* the network path: a dashed line on the floor with its distance */}
      <FloorLine points={NETWORK_PATH} color={COLOR.muted} opacity={0.5} dash={[0.25, 0.2]} />
      <Label text={`network · ${rttMs === 0 ? "no delay" : `${rttMs / 2} ms each way`}`} position={[0, 0.03, 1.45]} size={0.26} color={COLOR.muted} flat />
    </>
  );
});
