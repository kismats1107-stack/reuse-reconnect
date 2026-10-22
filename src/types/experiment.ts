/** The two connection strategies under test. */
export type Strategy = "close" | "keepalive";

/** What the experiment stage plays: one strategy or both side by side. */
export type RunMode = "compare" | Strategy;

export type Direction = "client-to-server" | "server-to-client";

export type EventType =
  | "SYN"
  | "SYN_ACK"
  | "ACK"
  | "HTTP_REQUEST"
  | "HTTP_RESPONSE"
  | "FIN"
  | "CONNECTION_REUSE";

/** Which part of a connection's life an event belongs to. */
export type Phase = "handshake" | "request" | "teardown";

export type NetworkEvent = {
  id: string;
  /** When the first bit leaves the sender (simulated ms from the start of the run). */
  timeMs: number;
  /** When the last bit reaches the receiver. Equal to `timeMs` for local markers. */
  arriveMs: number;
  connectionId: number;
  direction: Direction;
  type: EventType;
  phase: Phase;
  label: string;
  objectIndex?: number;
};

export type ModelParams = {
  /** Link bandwidth used for payload serialisation time. */
  bandwidthMbps: number;
  /** Time the server needs to produce each response, identical in both strategies. */
  serverMs: number;
};

export type ExperimentSettings = {
  objects: number;
  rttMs: number;
  mode: RunMode;
};

/** Everything one strategy produced for one set of settings. */
export type StrategyRun = {
  strategy: Strategy;
  objects: number;
  rttMs: number;
  events: NetworkEvent[];
  /** Page load time: last byte of the last response. */
  loadMs: number;
  /** When the final teardown packet lands; only used to finish the animation. */
  endMs: number;
};

export type Metrics = {
  connections: number;
  handshakes: number;
  requests: number;
  reuses: number;
  packets: number;
  /** Time spent waiting on handshakes (SYN sent → ACK sent), summed over connections. */
  handshakeMs: number;
  elapsedMs: number;
};
