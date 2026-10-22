import { Billboard, Edges, Text } from "@react-three/drei";
import { Suspense } from "react";
import mono600 from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff?url";
import { useColors } from "./theme";

type Props = {
  text: string;
  position: [number, number, number];
  /** Font size in world units. */
  size?: number;
  color?: string;
  /** Chip background; omitted = plain text with a dark outline. */
  bg?: string;
  /** Chip border colour. */
  border?: string;
  opacity?: number;
  /** Lie flat on the floor instead of facing the camera. */
  flat?: boolean;
};

/**
 * Text in the 3D world (SDF, rendered by the GPU, bundled font so it works
 * offline). Faces the camera unless `flat`. IBM Plex Mono advances 0.6 em per
 * character, so the chip can be sized without measuring.
 */
export function Label({ text, position, size = 0.3, color, bg, border, opacity = 1, flat = false }: Props) {
  const COLOR = useColors();
  const w = text.length * size * 0.6 + size * 1.1;
  const h = size * 1.6;
  const body = (
    <>
      {bg && (
        <mesh position={[0, 0, -0.005]} renderOrder={9}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial color={bg} transparent opacity={0.85 * opacity} depthWrite={false} toneMapped={false} />
          {border && <Edges color={border} />}
        </mesh>
      )}
      <Text
        font={mono600}
        fontSize={size}
        color={color ?? COLOR.text}
        anchorX="center"
        anchorY="middle"
        fillOpacity={opacity}
        outlineWidth={bg ? 0 : size * 0.09}
        outlineColor={COLOR.ink}
        outlineOpacity={opacity}
        renderOrder={10}
      >
        {text}
      </Text>
    </>
  );
  // Text suspends until its font is parsed; keep that local so the world renders at once.
  return (
    <Suspense fallback={null}>
      {flat ? (
        <group position={position} rotation={[-Math.PI / 2, 0, 0]}>
          {body}
        </group>
      ) : (
        <Billboard position={position}>{body}</Billboard>
      )}
    </Suspense>
  );
}
