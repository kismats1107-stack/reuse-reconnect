import { Label } from "./Label";
import { connState, type ConnTimes } from "../../lib/connections";
import { RAIL } from "./layout";
import { useColors } from "./theme";

type Props = { conn: ConnTimes; t: number; reuses: number; label: boolean };

const TEXT = { opening: "connecting", open: "open", closing: "closing" } as const;

/**
 * One TCP connection: two glowing tubes (to the server above, back to the
 * browser below). It grows across while the SYN travels, glows while open, and
 * turns grey and sinks while it is being closed.
 */
export function Cable({ conn, t, reuses, label }: Props) {
  const COLOR = useColors();
  const state = connState(conn, t);
  if (state === "idle" || state === "closed") return null;
  const span = RAIL.x1 - RAIL.x0;

  let len = span;
  let color: string = COLOR.cyan;
  let opacity = 0.9;
  let drop = 0;
  if (state === "opening") {
    const f = conn.synArrive > conn.syn ? Math.min(1, (t - conn.syn) / (conn.synArrive - conn.syn)) : 1;
    len = Math.max(0.01, span * f);
    color = COLOR.cost;
  } else if (state === "closing") {
    const f = conn.closed > conn.fin ? (t - conn.fin) / (conn.closed - conn.fin) : 1;
    color = COLOR.muted;
    opacity = 0.75 * (1 - f) + 0.1;
    drop = f * 0.5;
  }

  const tube = (y: number) => (
    <mesh position={[RAIL.x0 + len / 2, y - drop, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.055, 0.055, len, 10]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} />
    </mesh>
  );
  const socket = (x: number) => (
    <mesh position={[x, (RAIL.up + RAIL.down) / 2 - drop, 0]}>
      <boxGeometry args={[0.22, RAIL.up - RAIL.down + 0.4, 0.4]} />
      <meshStandardMaterial color={COLOR.ink} emissive={color} emissiveIntensity={0.5} transparent opacity={Math.min(1, opacity + 0.1)} />
    </mesh>
  );

  return (
    <group>
      {tube(RAIL.up)}
      {tube(RAIL.down)}
      {socket(RAIL.x0)}
      {len >= span && socket(RAIL.x1)}
      {state === "open" && (
        // soft glow band between the two tubes
        <mesh position={[0, (RAIL.up + RAIL.down) / 2, 0]}>
          <planeGeometry args={[span, RAIL.up - RAIL.down]} />
          <meshBasicMaterial color={COLOR.cyan} transparent opacity={0.06} toneMapped={false} depthWrite={false} />
        </mesh>
      )}
      {label && (
      <Label
        text={`Connection #${conn.id} · ${TEXT[state]}${state === "open" && reuses > 0 ? ` · reused ${reuses}×` : ""}`}
        position={[state === "closing" ? 3.0 : 0, RAIL.down - 0.62 - drop, 0]}
        size={0.24}
        color={color}
        bg={COLOR.ink}
        border={color}
        opacity={state === "closing" ? Math.max(0.35, opacity) : 1}
      />
      )}
    </group>
  );
}
