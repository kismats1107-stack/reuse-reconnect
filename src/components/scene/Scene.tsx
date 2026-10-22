import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3, type PerspectiveCamera } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Status } from "../../hooks/useExperiment";
import type { Strategy, StrategyRun } from "../../types/experiment";
import { LANE_Z, PALETTES } from "./layout";
import { PaletteContext, type Theme } from "./theme";
import { Lane } from "./Lane";

const MIN_DIST = 8;
const MAX_DIST = 70;

export type SceneLane = { strategy: Strategy; run?: StrategyRun };

type Props = {
  lanes: SceneLane[];
  clock: number;
  status: Status;
  glowMs: number;
  objects: number;
  rttMs: number;
  reduced: boolean;
  /** Bump to fly the camera back to the default view. */
  viewKey: number;
  /** Show the text tags on packets and connections. */
  labels: boolean;
  theme: Theme;
};

/** The whole 3D world: one lane per strategy, a floor grid, lights and an orbit camera. */
export function Scene({ lanes, clock, status, glowMs, objects, rttMs, reduced, viewKey, labels, theme }: Props) {
  const COLOR = PALETTES[theme];
  const compare = lanes.length > 1;
  return (
    <Canvas
      dpr={[1, 1.5]}
      // Draw only when something changes (the clock, the camera): idle costs nothing.
      frameloop="demand"
      camera={{ position: [0, 40, 52], fov: 32, near: 0.1, far: 300 }}
      gl={{ antialias: true }}
      onCreated={({ gl }) => {
        gl.setClearColor(PALETTES[theme].ink);
        // Reading shader logs after every compile is slow on weak GPUs; only useful while developing.
        gl.debug.checkShaderErrors = import.meta.env.DEV;
      }}
      aria-label="3D network world"
    >
      <PaletteContext.Provider value={COLOR}>
      <color attach="background" args={[COLOR.ink]} />
      <fog attach="fog" args={[COLOR.ink, 45, 95]} />
      <ambientLight intensity={theme === "light" ? 1.1 : 0.55} />
      <directionalLight position={[6, 14, 10]} intensity={1.2} />
      <pointLight position={[-7, 5, 4]} color={COLOR.cyan} intensity={18} distance={16} />
      <pointLight position={[7, 6, 4]} color={COLOR.lime} intensity={14} distance={16} />

      {/* plain grid lines: far cheaper than a full-screen grid shader on weak GPUs */}
      <gridHelper key={`g1-${theme}`} args={[120, 120, COLOR.grid, COLOR.grid]} position={[0, -0.01, 0]} />
      <gridHelper key={`g2-${theme}`} args={[120, 24, COLOR.gridMajor, COLOR.gridMajor]} position={[0, -0.005, 0]} />

      {lanes.map((l) => (
        <Lane
          key={l.strategy}
          strategy={l.strategy}
          run={l.run}
          z={compare ? (l.strategy === "close" ? LANE_Z.a : LANE_Z.b) : LANE_Z.single}
          clock={clock}
          status={status}
          glowMs={glowMs}
          objects={objects}
          rttMs={rttMs}
          reduced={reduced}
          labels={labels}
        />
      ))}

      <ProgramKeepers />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} enablePan={false} minDistance={MIN_DIST} maxDistance={MAX_DIST} minPolarAngle={0.25} maxPolarAngle={1.38} rotateSpeed={0.6} />
      <SmoothZoom />
      <CameraRig compare={compare} reduced={reduced} viewKey={viewKey} />
      </PaletteContext.Provider>
    </Canvas>
  );
}

/**
 * Flies the camera to the framing for one or two lanes (and in from far away on
 * first load: the zoom-in). Afterwards the visitor can orbit and zoom freely.
 */
function CameraRig({ compare, reduced, viewKey }: { compare: boolean; reduced: boolean; viewKey: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const aspect = useThree((s) => s.size.width / s.size.height);
  const invalidate = useThree((s) => s.invalidate);
  const anim = useRef<{ from: Vector3; to: Vector3; tFrom: Vector3; tTo: Vector3; start: number; dur: number } | null>(null);

  useEffect(() => {
    if (!controls) return;
    // Fit the world between the HUD bars: far enough back that both its width
    // and its (projected) depth fit, whatever the screen's shape.
    const fov = ((camera as PerspectiveCamera).fov * Math.PI) / 180;
    const tan = Math.tan(fov / 2);
    const elevation = compare ? 0.88 : 0.8; // radians above the horizon
    const needW = 23;
    const needH = compare ? 14.5 : 8;
    const dist = Math.max(needW / (2 * tan * aspect), needH / (2 * tan * 0.74));
    // aim a little in front of centre: the control dock covers more of the bottom than the top bar
    const tTo = new Vector3(0, 0.6, compare ? 2.1 : 1.2);
    const to = tTo.clone().add(new Vector3(0, Math.sin(elevation), Math.cos(elevation)).multiplyScalar(dist));
    if (reduced) {
      camera.position.copy(to);
      controls.target.copy(tTo);
      controls.update();
      return;
    }
    anim.current = { from: camera.position.clone(), to, tFrom: controls.target.clone(), tTo, start: -1, dur: 1.6 };
    invalidate();
  }, [compare, aspect, controls, camera, reduced, viewKey, invalidate]);

  useFrame((state) => {
    const a = anim.current;
    if (!a || !controls) return;
    if (a.start < 0) a.start = state.clock.elapsedTime;
    const p = Math.min(1, (state.clock.elapsedTime - a.start) / a.dur);
    const e = 1 - Math.pow(1 - p, 3);
    camera.position.lerpVectors(a.from, a.to, e);
    controls.target.lerpVectors(a.tFrom, a.tTo, e);
    controls.update();
    if (p >= 1) anim.current = null;
    else state.invalidate();
  });
  return null;
}

/**
 * three.js deletes a shader program when the last object using it goes away.
 * Packets and connections come and go many times a second, so their shaders
 * would be recompiled over and over. One tiny, permanently mounted mesh per
 * material variant keeps every program alive (they sit under the floor).
 */
function ProgramKeepers() {
  return (
    <group position={[0, -5, 0]} scale={0.001}>
      <mesh>
        <boxGeometry />
        <meshStandardMaterial transparent toneMapped={false} />
      </mesh>
      <mesh>
        <boxGeometry />
        <meshStandardMaterial transparent />
      </mesh>
      <mesh>
        <boxGeometry />
        <meshBasicMaterial transparent toneMapped={false} />
      </mesh>
      <mesh>
        <boxGeometry />
        <meshBasicMaterial transparent />
      </mesh>
      <mesh>
        <boxGeometry />
        <meshStandardMaterial />
      </mesh>
    </group>
  );
}

/**
 * Mouse-wheel zoom that glides instead of jumping: each wheel tick moves a
 * target distance, and the camera eases toward it. (Touch pinch-zoom is still
 * handled by OrbitControls.)
 */
function SmoothZoom() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const dom = useThree((s) => s.gl.domElement);
  const invalidate = useThree((s) => s.invalidate);
  const desired = useRef<number | null>(null);

  useEffect(() => {
    if (!controls) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      // Capture phase on the canvas: keep OrbitControls' stepwise zoom from also reacting.
      ev.stopImmediatePropagation();
      const current = camera.position.distanceTo(controls.target);
      const base = desired.current ?? current;
      const delta = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaY;
      desired.current = Math.min(MAX_DIST, Math.max(MIN_DIST, base * Math.exp(delta * 0.0011)));
      invalidate();
    };
    dom.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => dom.removeEventListener("wheel", onWheel, { capture: true });
  }, [camera, controls, dom, invalidate]);

  useFrame(() => {
    const goal = desired.current;
    if (goal === null || !controls) return;
    const offset = camera.position.clone().sub(controls.target);
    const dist = offset.length();
    const next = dist + (goal - dist) * 0.16;
    camera.position.copy(controls.target).add(offset.setLength(next));
    controls.update();
    if (Math.abs(goal - next) < 0.01) desired.current = null;
    else invalidate();
  });
  return null;
}
