import { useEffect, useMemo } from "react";
import { BufferGeometry, Line as ThreeLine, LineBasicMaterial, LineDashedMaterial, Vector3 } from "three";

type Props = {
  points: [number, number, number][];
  color: string;
  opacity?: number;
  /** [dash, gap] in world units; omit for a solid line. */
  dash?: [number, number];
};

/**
 * A plain 1px three.js line, built once. (drei's <Line> rebuilds its geometry
 * whenever its parent re-renders, which here is every animation frame.)
 */
export function FloorLine({ points, color, opacity = 1, dash }: Props) {
  const key = JSON.stringify(points);
  const line = useMemo(() => {
    const geom = new BufferGeometry().setFromPoints(points.map((p) => new Vector3(...p)));
    const mat = dash
      ? new LineDashedMaterial({ color, transparent: true, opacity, dashSize: dash[0], gapSize: dash[1] })
      : new LineBasicMaterial({ color, transparent: true, opacity });
    const l = new ThreeLine(geom, mat);
    if (dash) l.computeLineDistances();
    return l;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for `points`
  }, [key, color, opacity, dash?.[0], dash?.[1]]);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as LineBasicMaterial).dispose();
    },
    [line],
  );
  return <primitive object={line} />;
}
