import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";
import { kindColor, type PacketKind } from "./layout";
import { useColors } from "./theme";
import { Label } from "./Label";

type Props = {
  kind: PacketKind;
  label: string;
  position: [number, number, number];
  opacity: number;
  /** Responses grow with the file they carry. */
  size?: number;
  showLabel: boolean;
  spin: boolean;
};

/**
 * One packet. Shape and label both name the type, so colour is never the only
 * cue: handshakes are diamonds, requests small cubes, responses bigger cubes,
 * teardown packets rings.
 */
export function PacketMesh({ kind, label, position, opacity, size = 1, showLabel, spin }: Props) {
  const COLOR = useColors();
  const ref = useRef<Mesh>(null);
  useFrame((_, dt) => {
    if (spin && ref.current) ref.current.rotation.y += dt * 1.6;
  });
  const color = kindColor(COLOR)[kind];
  return (
    <group position={position}>
      <mesh ref={ref} scale={size}>
        {kind === "handshake" && <octahedronGeometry args={[0.3, 0]} />}
        {kind === "request" && <boxGeometry args={[0.38, 0.38, 0.38]} />}
        {kind === "response" && <boxGeometry args={[0.5, 0.5, 0.5]} />}
        {kind === "teardown" && <torusGeometry args={[0.2, 0.06, 8, 20]} />}
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} transparent opacity={opacity} toneMapped={false} />
      </mesh>
      {showLabel && opacity > 0.25 && (
        <Label
          text={label}
          position={[0, 0.3 * size + 0.32, 0]}
          size={0.22}
          color={kind === "teardown" ? COLOR.muted : COLOR.ink}
          bg={kind === "teardown" ? COLOR.ink : color}
          border={kind === "teardown" ? COLOR.muted : undefined}
          opacity={opacity}
        />
      )}
    </group>
  );
}
