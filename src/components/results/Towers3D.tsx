import { Edges, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BoxGeometry, type Group, MeshStandardMaterial } from "three";
import { useOnScreen } from "../../hooks/useInView";
import { ms } from "../../lib/format";
import { compare } from "../../lib/metrics";
import { segments, type Segment } from "../../lib/segments";
import type { StrategyRun } from "../../types/experiment";
import { Label } from "../scene/Label";
import { PALETTES, type Palette } from "../scene/layout";
import { PaletteContext, type Theme } from "../scene/theme";

type Props = { close: StrategyRun; keepalive: StrategyRun; theme: Theme; reduced: boolean };

const TOWER_H = 7; // world units for the slower tower
const GAP = 0.05;
const X = { a: -1.9, b: 1.9 };

/**
 * Two towers of glowing blocks, one block per handshake (orange) or file
 * request (cyan), stacked in the order they happen. Height is time, so the
 * taller tower is the slower page. A dashed ghost on top of tower B shows the
 * time Keep-Alive saves.
 */
export function Towers3D({ close, keepalive, theme, reduced }: Props) {
  const [ref, onScreen] = useOnScreen<HTMLDivElement>();
  const c = PALETTES[theme];
  return (
    <div ref={ref} className="h-full w-full">
      <Canvas
        dpr={[1, 1.5]}
        // Spin only while visible; otherwise draw on demand.
        frameloop={onScreen && !reduced ? "always" : "demand"}
        camera={{ position: [10, 7.5, 14], fov: 35 }}
        onCreated={({ gl }) => {
          gl.debug.checkShaderErrors = import.meta.env.DEV;
        }}
        aria-label="3D towers: time spent on handshakes and file requests for each strategy"
      >
        <PaletteContext.Provider value={c}>
          <color attach="background" args={[c.ink]} />
          <ambientLight intensity={theme === "light" ? 1.1 : 0.6} />
          <directionalLight position={[5, 10, 6]} intensity={1.3} />
          <pointLight position={[-4, 6, 4]} color={c.cost} intensity={10} distance={14} />
          <pointLight position={[4, 6, 4]} color={c.lime} intensity={10} distance={14} />
          <gridHelper key={theme} args={[30, 30, c.gridMajor, c.grid]} />
          <Towers close={close} keepalive={keepalive} c={c} reduced={reduced} />
          <OrbitControls
            makeDefault
            enableDamping
            enablePan={false}
            enableZoom={false}
            autoRotate={!reduced}
            autoRotateSpeed={0.55}
            minPolarAngle={0.5}
            maxPolarAngle={1.35}
            target={[0, TOWER_H * 0.5, 0]}
          />
        </PaletteContext.Provider>
      </Canvas>
    </div>
  );
}

function Towers({ close, keepalive, c, reduced }: { close: StrategyRun; keepalive: StrategyRun; c: Palette; reduced: boolean }) {
  const k = TOWER_H / Math.max(close.loadMs, keepalive.loadMs, 1);
  const segA = useMemo(() => segments(close), [close]);
  const segB = useMemo(() => segments(keepalive), [keepalive]);
  const saved = compare(close, keepalive).savedMs;
  // Shared geometry and materials: blocks come and go, programs must not.
  const geo = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const mats = useMemo(
    () => ({
      handshake: new MeshStandardMaterial({ color: c.cost, emissive: c.cost, emissiveIntensity: 0.55, roughness: 0.4 }),
      request: new MeshStandardMaterial({ color: c.cyan, emissive: c.cyan, emissiveIntensity: 0.35, roughness: 0.4 }),
    }),
    [c],
  );
  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  const hA = close.loadMs * k;
  const hB = keepalive.loadMs * k;
  return (
    <group>
      <Tower key={`a-${close.objects}-${close.rttMs}`} x={X.a} segs={segA} k={k} geo={geo} mats={mats} reduced={reduced} />
      <Tower key={`b-${keepalive.objects}-${keepalive.rttMs}`} x={X.b} segs={segB} k={k} geo={geo} mats={mats} reduced={reduced} />

      {/* pedestals + names */}
      {[
        [X.a, "A · NEW CONNECTION", c.cost],
        [X.b, "B · KEEP-ALIVE", c.lime],
      ].map(([x, name, col]) => (
        <group key={name as string} position={[x as number, 0, 0]}>
          <mesh position={[0, 0.06, 0]}>
            <boxGeometry args={[2.2, 0.12, 2.2]} />
            <meshStandardMaterial color={c.surface} />
            <Edges color={col as string} />
          </mesh>
          <Label text={name as string} position={[0, 0.02, 1.55]} size={0.24} color={col as string} bg={c.ink} border={col as string} flat />
        </group>
      ))}

      {/* totals above each tower */}
      <Label text={ms(close.loadMs)} position={[X.a, hA + 0.75, 0]} size={0.42} color={c.text} />
      <Label text={`${segA.filter((s) => s.kind === "handshake").length} handshakes`} position={[X.a, hA + 0.35, 0]} size={0.22} color={c.cost} />
      <Label text={ms(keepalive.loadMs)} position={[X.b, hB + 0.75, 0]} size={0.42} color={c.text} />
      <Label text="1 handshake" position={[X.b, hB + 0.35, 0]} size={0.22} color={c.lime} />

      {/* the time Keep-Alive saves: a ghost block on top of B up to A's height */}
      {saved > 0.5 && hA - hB > 0.25 && (
        <group position={[X.b, hB + 0.12 + (hA - hB) / 2, 0]}>
          <mesh>
            <boxGeometry args={[1.5, hA - hB, 1.5]} />
            <meshBasicMaterial color={c.lime} transparent opacity={0.07} depthWrite={false} />
            <Edges color={c.lime} />
          </mesh>
          {hA - hB > 1.4 && <Label text={`saved ${ms(saved)}`} position={[0, 0, 0.9]} size={0.26} color={c.lime} bg={c.ink} border={c.lime} />}
        </group>
      )}
    </group>
  );
}

/** One tower; its blocks drop in one after another whenever the settings change. */
function Tower({ x, segs, k, geo, mats, reduced }: { x: number; segs: Segment[]; k: number; geo: BoxGeometry; mats: Record<Segment["kind"], MeshStandardMaterial>; reduced: boolean }) {
  const group = useRef<Group>(null);
  const start = useRef<number | null>(null);
  const invalidate = useThree((s) => s.invalidate);
  const step = Math.min(0.06, 1.4 / Math.max(segs.length, 1));
  const fall = 0.45;

  // stack bottom-up: each block starts where the time before it ends
  const blocks = segs.map((s) => {
    const h = Math.max(0.02, s.durMs * k - GAP);
    return { y: 0.12 + s.startMs * k + h / 2, h, kind: s.kind };
  });

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    if (start.current === null) start.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - start.current;
    let moving = false;
    g.children.forEach((m, i) => {
      const b = blocks[i];
      if (!b) return;
      const p = reduced ? 1 : Math.min(1, Math.max(0, (t - i * step) / fall));
      const e = 1 - Math.pow(1 - p, 3);
      m.position.y = b.y + (1 - e) * 4;
      m.visible = p > 0;
      if (p < 1) moving = true;
    });
    if (moving) invalidate();
  });

  return (
    <group ref={group} position={[x, 0, 0]}>
      {blocks.map((b, i) => (
        <mesh key={i} geometry={geo} material={mats[b.kind]} position={[0, b.y + (reduced ? 0 : 4), 0]} scale={[1.5, b.h, 1.5]} visible={reduced} />
      ))}
    </group>
  );
}
