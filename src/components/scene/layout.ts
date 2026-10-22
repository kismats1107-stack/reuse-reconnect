import type { NetworkEvent } from "../../types/experiment";

/** World units. The browser sits on the left, the server on the right. */
export const BROWSER_X = -7;
export const SERVER_X = 7;
export const RAIL = { x0: -4.9, x1: 4.9, up: 2.2, down: 1.35 };
export const LANE_Z = { single: 0, a: -4.2, b: 4.2 };

export type Palette = {
  ink: string;
  surface: string;
  raised: string;
  edge: string;
  cyan: string;
  lime: string;
  cost: string;
  muted: string;
  text: string;
  /** laptop base, server body, unlit page tile, rack face */
  base: string;
  body: string;
  tileOff: string;
  rack: string;
  grid: string;
  gridMajor: string;
};

/** 3D colours per theme (three.js needs real colours, not CSS variables). */
export const PALETTES: Record<"dark" | "light", Palette> = {
  dark: {
    ink: "#080b12",
    surface: "#101722",
    raised: "#151f2d",
    edge: "#2b3b50",
    cyan: "#54d9f5",
    lime: "#c7f36b",
    cost: "#ff9466",
    muted: "#9ba9bb",
    text: "#f3f6fa",
    base: "#1a2636",
    body: "#121b27",
    tileOff: "#22324a",
    rack: "#1a2738",
    grid: "#14202e",
    gridMajor: "#1e3a4c",
  },
  light: {
    ink: "#eef2f7",
    surface: "#dfe6ef",
    raised: "#f8fafc",
    edge: "#93a3b8",
    cyan: "#0891b2",
    lime: "#4d7c0f",
    cost: "#c2410c",
    muted: "#64748b",
    text: "#0b1220",
    base: "#cbd5e1",
    body: "#d5dde8",
    tileOff: "#c2cdda",
    rack: "#e8edf3",
    grid: "#e2e8ef",
    gridMajor: "#cdd6e1",
  },
};

export type PacketKind = "handshake" | "request" | "response" | "teardown";

export function packetKind(e: NetworkEvent): PacketKind {
  if (e.phase === "handshake") return "handshake";
  if (e.phase === "teardown") return "teardown";
  return e.type === "HTTP_RESPONSE" ? "response" : "request";
}

export function kindColor(c: Palette): Record<PacketKind, string> {
  return { handshake: c.cost, request: c.cyan, response: c.lime, teardown: c.muted };
}

/** The same packet colours as CSS variables, for HTML and SVG (they follow the theme). */
export const KIND_CSS: Record<PacketKind, string> = {
  handshake: "var(--color-cost)",
  request: "var(--color-cyan)",
  response: "var(--color-lime)",
  teardown: "var(--color-muted)",
};
