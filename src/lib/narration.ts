import type { NetworkEvent, StrategyRun } from "../types/experiment";
import { ASSETS, formatBytes } from "./simulation";

export type Line = {
  who: "Browser" | "Server";
  /** The real protocol name, shown small next to the plain sentence. */
  tech: string;
  /** What the sender "says", in everyday words. */
  say: string;
  /** One or two sentences for the guided tour. */
  teach: string;
};

export function fileName(e: NetworkEvent): string {
  return e.objectIndex === undefined ? "" : ASSETS[e.objectIndex].path.slice(1);
}

/** Plain-language narration for one event, used by captions and the guided tour. */
export function narrate(e: NetworkEvent): Line {
  const who = e.direction === "client-to-server" ? "Browser" : "Server";
  const file = fileName(e);
  switch (e.type) {
    case "SYN":
      return {
        who,
        tech: "SYN",
        say: "Hello server, can we connect?",
        teach: "Handshake step 1. Before any file can move, the browser has to ask the server to open a TCP connection.",
      };
    case "SYN_ACK":
      return {
        who,
        tech: "SYN-ACK",
        say: "Yes, I'm ready!",
        teach: "Handshake step 2. The server agrees. This reply had to travel all the way back, so a full round trip is spent just saying hello.",
      };
    case "ACK":
      return e.phase === "handshake"
        ? { who, tech: "ACK", say: "Great, we're connected.", teach: "Handshake step 3. The connection is open. Only now may the browser ask for a file." }
        : { who, tech: "ACK", say: "Goodbye!", teach: "The last goodbye: this connection is now completely closed." };
    case "HTTP_REQUEST":
      return { who, tech: "GET", say: `Please send me ${file}.`, teach: `The browser asks for one file of the page (${file}) with an HTTP GET request.` };
    case "HTTP_RESPONSE":
      return {
        who,
        tech: "200 OK",
        say: `Here is ${file} (${formatBytes(ASSETS[e.objectIndex ?? 0].bytes)}).`,
        teach: `The server sends ${file} back. One more file of the page has arrived.`,
      };
    case "FIN":
      return who === "Server"
        ? {
            who,
            tech: "FIN",
            say: e.label === "FIN" ? "I'm closing this connection." : "OK, closing too.",
            teach:
              e.label === "FIN"
                ? "With “Connection: close”, the server hangs up after every file. The next file needs a brand-new connection, and a new handshake."
                : "The server closes its side as well.",
          }
        : {
            who,
            tech: e.label === "FIN" ? "FIN" : "FIN+ACK",
            say: e.label === "FIN" ? "All files done, closing now." : "OK, closing my side too.",
            teach: e.label === "FIN" ? "Every file has arrived, so the browser finally closes the one connection it used." : "The browser closes its side of the old connection.",
          };
    case "CONNECTION_REUSE":
      return {
        who: "Browser",
        tech: "REUSE",
        say: "Same connection, next file please!",
        teach: "Keep-Alive: the connection is still open, so the next request goes out straight away. No handshake needed!",
      };
  }
}

/**
 * Splits a run into tour steps. Each step plays until its first packet lands
 * and explains everything that left the sender during that time, so packets
 * that travel together (ACK + GET) are explained together.
 */
export function tourSteps(run: StrategyRun): { target: number; events: NetworkEvent[] }[] {
  const steps: { target: number; events: NetworkEvent[] }[] = [];
  const ev = run.events;
  let i = 0;
  while (i < ev.length) {
    const first = ev[i];
    // A zero-time marker (connection reuse) plays until the packets that leave with it land.
    let target = first.arriveMs;
    for (let k = i; k < ev.length && ev[k].timeMs === first.timeMs; k++) target = Math.max(target, ev[k].arriveMs);
    const group: NetworkEvent[] = [];
    let j = i;
    // Everything that leaves at the same moment, or before the step's packet lands.
    while (j < ev.length && (ev[j].timeMs === first.timeMs || ev[j].timeMs < target)) group.push(ev[j++]);
    steps.push({ target, events: group });
    i = j;
  }
  return steps;
}
