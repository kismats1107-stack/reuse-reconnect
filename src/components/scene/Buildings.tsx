import { Edges } from "@react-three/drei";
import { Label } from "./Label";
import { BROWSER_X, SERVER_X } from "./layout";
import { useColors } from "./theme";

type Pulse = { pulse: number };

function Pedestal() {
  const COLOR = useColors();
  return (
    <mesh position={[0, 0.25, 0]}>
      <boxGeometry args={[3.3, 0.5, 2.5]} />
      <meshStandardMaterial color={COLOR.surface} roughness={0.8} />
      <Edges color={COLOR.edge} />
    </mesh>
  );
}

/** A ring on the floor that flashes when a packet lands. */
function ArrivalRing({ pulse, color }: { pulse: number; color: string }) {
  if (pulse <= 0) return null;
  // a square outline around the pedestal that expands and fades
  const s = 1 + (1 - pulse) * 0.18;
  return (
    <group position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[s, s * 0.77, 1]}>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <ringGeometry args={[2.5, 2.6, 4, 1]} />
        <meshBasicMaterial color={color} transparent opacity={pulse * 0.8} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Tag({ title, sub, y, subColor }: { title: string; sub: string; y: number; subColor?: string }) {
  const COLOR = useColors();
  return (
    <>
      <Label text={title} position={[0, y + 0.42, 0]} size={0.42} />
      <Label text={sub} position={[0, y, 0]} size={0.26} color={subColor ?? COLOR.muted} bg={COLOR.ink} />
    </>
  );
}

type BrowserProps = Pulse & { z: number; filesDone: number; filesTotal: number; loadedText?: string };

/**
 * The browser: a laptop on a pedestal. Its screen is the web page being built,
 * one tile per file, lighting up as each file arrives.
 */
export function Browser({ z, pulse, filesDone, filesTotal, loadedText }: BrowserProps) {
  const COLOR = useColors();
  // a few big tiles for a small page, up to 8 × 5 for 40 files
  const cols = Math.min(8, Math.max(2, Math.ceil(Math.sqrt(filesTotal * 2))));
  const rows = Math.max(1, Math.ceil(filesTotal / cols));
  const tileW = 2.2 / cols;
  const tileH = Math.min(0.3, 1.15 / rows);
  return (
    <group position={[BROWSER_X, 0, z]}>
      <Pedestal />
      <ArrivalRing pulse={pulse} color={COLOR.lime} />
      {/* base */}
      <mesh position={[0, 0.56, 0.15]}>
        <boxGeometry args={[2.7, 0.12, 1.7]} />
        <meshStandardMaterial color={COLOR.base} roughness={0.6} />
        <Edges color={COLOR.edge} />
      </mesh>
      {/* screen */}
      <group position={[0, 0.62, -0.7]} rotation={[-0.16, 0, 0]}>
        <mesh position={[0, 0.9, 0]}>
          <boxGeometry args={[2.7, 1.8, 0.08]} />
          <meshStandardMaterial color={COLOR.raised} roughness={0.5} />
          <Edges color={COLOR.edge} />
        </mesh>
        {/* address bar */}
        <mesh position={[0, 1.62, 0.05]}>
          <planeGeometry args={[2.3, 0.12]} />
          <meshBasicMaterial color={COLOR.cyan} toneMapped={false} transparent opacity={0.75} />
        </mesh>
        {/* one tile per file of the page */}
        {Array.from({ length: filesTotal }, (_, i) => {
          const c = i % cols;
          const r = Math.floor(i / cols);
          const lit = i < filesDone;
          return (
            <mesh key={i} position={[-1.1 + tileW * (c + 0.5), 1.42 - tileH * (r + 0.5) - 0.04, 0.05]}>
              <planeGeometry args={[tileW * 0.82, tileH * 0.78]} />
              <meshBasicMaterial color={lit ? COLOR.lime : COLOR.tileOff} toneMapped={false} />
            </mesh>
          );
        })}
      </group>
      <Tag title="BROWSER" sub={loadedText ?? "your laptop"} subColor={loadedText ? COLOR.lime : undefined} y={3.3} />
    </group>
  );
}

type ServerProps = Pulse & { z: number; served: number };

/** The web server: a rack tower whose lights flash when a request arrives. */
export function Server({ z, pulse, served }: ServerProps) {
  const COLOR = useColors();
  const glow = 0.35 + pulse * 0.65;
  return (
    <group position={[SERVER_X, 0, z]}>
      <Pedestal />
      <ArrivalRing pulse={pulse} color={COLOR.cyan} />
      <mesh position={[0, 1.95, 0]}>
        <boxGeometry args={[1.8, 2.9, 1.8]} />
        <meshStandardMaterial color={COLOR.body} roughness={0.7} />
        <Edges color={COLOR.edge} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <group key={i} position={[0, 0.95 + i * 0.66, 0.91]}>
          <mesh>
            <planeGeometry args={[1.5, 0.42]} />
            <meshStandardMaterial color={COLOR.rack} />
          </mesh>
          <mesh position={[-0.5, 0, 0.01]}>
            <circleGeometry args={[0.06, 16]} />
            <meshBasicMaterial color={COLOR.lime} toneMapped={false} transparent opacity={i % 2 ? glow : 0.4 + pulse * 0.6} />
          </mesh>
          <mesh position={[0.25, 0, 0.01]}>
            <planeGeometry args={[0.8, 0.05]} />
            <meshBasicMaterial color={COLOR.lime} toneMapped={false} transparent opacity={glow * 0.7} />
          </mesh>
        </group>
      ))}
      <Tag title="SERVER" sub={`${served} file${served === 1 ? "" : "s"} sent`} y={3.85} />
    </group>
  );
}
