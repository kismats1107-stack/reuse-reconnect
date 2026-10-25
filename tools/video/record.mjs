// Recording autopilot for the project video.
//
//   node tools/video/record.mjs              hands-free: teleprompter window, segments advance by themselves
//   node tools/video/record.mjs --manual     terminal teleprompter, Enter between segments
//   node tools/video/record.mjs --from 4     start at segment 4 (--to 6 stops after segment 6)
//   node tools/video/record.mjs --url http://localhost:5180/
//   node tools/video/record.mjs --dry-run    no OBS, no Enter: just run every demo once
//   node tools/video/record.mjs --obs-check  connect to OBS, create the scenes, report, exit
//   node tools/video/record.mjs --no-cam     record without the face-cam corner
//
// It opens a full-screen Chrome window on the site and does the clicking for
// each segment of script.mjs. A separate always-on-top "Teleprompter" window
// shows the lines to read; OBS never records it (it records by window title).
// OBS (through its WebSocket server) records only that Chrome window, and
// Wireshark in segment 6: recording starts, pauses between segments and stops
// at the end, so the video needs no editing.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createServer } from "node:http";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { SEGMENTS, VIDEO } from "./script.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, dflt) => (args.includes(name) ? args[args.indexOf(name) + 1] : dflt);
const DRY = flag("--dry-run");
const HEADLESS = flag("--headless");
const FROM = Number(opt("--from", 1));
const TO = Number(opt("--to", SEGMENTS.length));
const MANUAL = flag("--manual");
const PACE = Number(opt("--pace", 1)); // < 1 only to test the flow quickly
const WORDS_PER_SEC = 2.1; // ~125 words a minute: a calm reading pace
const SHOTS = opt("--shots", null); // folder: save a screenshot after each segment (for checking a dry run)
const SITE = opt("--url", VIDEO.site + "/").replace(/\/?$/, "/");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const WIRESHARK = "C:/Program Files/Wireshark/Wireshark.exe";
const PYTHON = "C:/Users/Hp/anaconda3/python.exe";
const TITLE = "Reuse / Reconnect"; // OBS captures the Chrome window with exactly this title
const SCENE_WEB = "RR · Browser";
const SCENE_WS = "RR · Wireshark";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- terminal
const C = { dim: "\x1b[2m", b: "\x1b[1m", lime: "\x1b[92m", cyan: "\x1b[96m", yel: "\x1b[93m", red: "\x1b[91m", r: "\x1b[0m" };
const rl = createInterface({ input: process.stdin, output: process.stdout });
const enter = (msg) => (DRY ? Promise.resolve() : new Promise((r) => rl.question(`${C.yel}${msg}${C.r}`, () => r())));
const wrap = (text, width = 78) => {
  const out = [];
  let line = "";
  for (const w of text.split(" ")) {
    if ((line + " " + w).trim().length > width) {
      out.push(line);
      line = w;
    } else line = (line + " " + w).trim();
  }
  if (line) out.push(line);
  return out;
};
function teleprompter(seg) {
  console.log(`\n${C.cyan}${"━".repeat(80)}${C.r}`);
  console.log(`${C.b}${C.lime} ${seg.start}–${seg.end}   ${seg.n} · ${seg.title}${C.r}   ${C.dim}(${seg.rubric})${C.r}`);
  console.log(`${C.cyan}${"━".repeat(80)}${C.r}`);
  for (const p of seg.say) {
    for (const l of wrap(p)) console.log("  " + l.replace(/\[([^\]]+)\]/g, `${C.yel}[$1]${C.r}`));
    console.log("");
  }
}

// ---------------------------------------------------------------- OBS (obs-websocket v5)
class Obs {
  async connect() {
    const cfgPath = join(process.env.APPDATA, "obs-studio", "plugin_config", "obs-websocket", "config.json");
    const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
    if (!cfg.server_enabled) throw new Error("OBS WebSocket server is off (OBS → Tools → WebSocket Server Settings → Enable)");
    // Connect to the OBS you opened; never start a second copy (two copies fight over the webcam).
    for (let i = 0; i < 10; i++) {
      try {
        await this.open(`ws://127.0.0.1:${cfg.server_port}`, cfg.auth_required ? cfg.server_password : null);
        return;
      } catch {
        if (i === 0) console.log(`${C.yel}Waiting for OBS… open OBS Studio if it is not running.${C.r}`);
        await sleep(1500);
      }
    }
    throw new Error("could not reach OBS. Open OBS Studio once (not twice), then run this again.");
  }
  open(url, password) {
    return new Promise((res, rej) => {
      // OBS answers with the obswebsocket.json subprotocol; the client must ask for it
      const ws = new WebSocket(url, ["obswebsocket.json"]);
      this.ws = ws;
      this.pending = new Map();
      this.n = 0;
      ws.addEventListener("error", () => rej(new Error("ws error")), { once: true });
      ws.addEventListener("close", (e) => rej(new Error(`OBS closed the connection (${e.code}${e.reason ? ` ${e.reason}` : ""})`)), { once: true });
      ws.addEventListener("message", (ev) => {
        const m = JSON.parse(ev.data);
        if (m.op === 0) {
          const auth = m.d.authentication;
          const d = { rpcVersion: 1, eventSubscriptions: 0 };
          if (auth && password) {
            const secret = createHash("sha256").update(password + auth.salt).digest("base64");
            d.authentication = createHash("sha256").update(secret + auth.challenge).digest("base64");
          }
          ws.send(JSON.stringify({ op: 1, d }));
        } else if (m.op === 2) res();
        else if (m.op === 7) {
          const p = this.pending.get(m.d.requestId);
          if (p) {
            this.pending.delete(m.d.requestId);
            m.d.requestStatus.result ? p.res(m.d.responseData ?? {}) : p.rej(new Error(`${m.d.requestType}: ${m.d.requestStatus.comment ?? m.d.requestStatus.code}`));
          }
        }
      });
    });
  }
  call(requestType, requestData = {}) {
    const requestId = String(++this.n);
    return new Promise((res, rej) => {
      this.pending.set(requestId, { res, rej });
      this.ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
    });
  }
  async ensureWindowScene(scene, input, settings) {
    const { scenes } = await this.call("GetSceneList");
    if (!scenes.some((s) => s.sceneName === scene)) await this.call("CreateScene", { sceneName: scene });
    const { inputs } = await this.call("GetInputList", { inputKind: "window_capture" });
    if (inputs.some((i) => i.inputName === input)) await this.call("SetInputSettings", { inputName: input, inputSettings: settings });
    else await this.call("CreateInput", { sceneName: scene, inputName: input, inputKind: "window_capture", inputSettings: settings });
    const { sceneItemId } = await this.call("GetSceneItemId", { sceneName: scene, sourceName: input });
    const v = await this.call("GetVideoSettings");
    await this.call("SetSceneItemTransform", {
      sceneName: scene,
      sceneItemId,
      sceneItemTransform: { positionX: 0, positionY: 0, alignment: 5, boundsType: "OBS_BOUNDS_SCALE_INNER", boundsAlignment: 0, boundsWidth: v.baseWidth, boundsHeight: v.baseHeight },
    });
  }
  /**
   * Puts the existing webcam source (OBS "Video Capture Device") in the bottom-right
   * corner of a scene. 232 × 130 at the edge of a 1920 × 1080 canvas stays clear
   * of the lab's control bar, which ends 240 px from the right.
   */
  async addCam(sceneName) {
    const { inputs } = await this.call("GetInputList", { inputKind: "dshow_input" });
    const cam = inputs[0]?.inputName;
    if (!cam) return null;
    const { sceneItems } = await this.call("GetSceneItemList", { sceneName });
    let item = sceneItems.find((i) => i.sourceName === cam)?.sceneItemId;
    if (!item) item = (await this.call("CreateSceneItem", { sceneName, sourceName: cam })).sceneItemId;
    const v = await this.call("GetVideoSettings");
    const w = Math.round(v.baseWidth * 0.121), hgt = Math.round((w * 9) / 16), m = Math.round(v.baseWidth * 0.006);
    await this.call("SetSceneItemTransform", {
      sceneName,
      sceneItemId: item,
      sceneItemTransform: { positionX: v.baseWidth - m, positionY: v.baseHeight - m, alignment: 10, boundsType: "OBS_BOUNDS_SCALE_OUTER", boundsAlignment: 0, boundsWidth: w, boundsHeight: hgt, cropLeft: 0, cropRight: 0 },
    });
    await this.call("SetSceneItemIndex", { sceneName, sceneItemId: item, sceneItemIndex: sceneItems.length }); // on top
    await this.call("SetSceneItemEnabled", { sceneName, sceneItemId: item, sceneItemEnabled: !flag("--no-cam") });
    return cam;
  }
  async setup() {
    // window "title:class:exe"; priority 1 = title must match, 2 = title, else same exe; method 2 = Windows Graphics Capture
    await this.ensureWindowScene(SCENE_WEB, "RR Chrome window", { window: `${TITLE}:Chrome_WidgetWin_1:chrome.exe`, priority: 1, method: 2, cursor: false, client_area: true });
    await this.ensureWindowScene(SCENE_WS, "RR Wireshark window", { window: "Wireshark:Qt5152QWindowIcon:Wireshark.exe", priority: 2, method: 2, cursor: false, client_area: true });
    const cam = (await this.addCam(SCENE_WEB)) && (await this.addCam(SCENE_WS));
    console.log(cam ? `${C.dim}face-cam: ${flag("--no-cam") ? "off (--no-cam)" : "bottom-right corner"}${C.r}` : `${C.red}No webcam source found in OBS; recording without face-cam.${C.r}`);
    await this.call("SetCurrentProgramScene", { sceneName: SCENE_WEB });
    const special = await this.call("GetSpecialInputs");
    if (!special.mic1) console.log(`${C.red}No microphone in OBS (Settings → Audio → Mic/Auxiliary Audio). Set it before recording.${C.r}`);
  }
}
const obs = DRY ? null : new Obs();
const scene = async (name) => obs && (await obs.call("SetCurrentProgramScene", { sceneName: name }));

// ---------------------------------------------------------------- Chrome (DevTools protocol)
async function launchChrome() {
  const profile = join(ROOT, "tools", "video", ".chrome-profile");
  mkdirSync(profile, { recursive: true });
  const port = 9333;
  const flags = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--force-device-scale-factor=1.25",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-features=Translate,InfiniteSessionRestore",
    "--autoplay-policy=no-user-gesture-required",
    HEADLESS ? "--headless=new" : "--start-fullscreen",
    "--window-size=1920,1080",
    `--app=${SITE}#/results`,
  ];
  const proc = spawn(CHROME, flags, { stdio: "ignore" });
  let page;
  for (let i = 0; i < 60 && !page; i++) {
    try {
      page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page");
    } catch {
      /* starting */
    }
    await sleep(250);
  }
  if (!page) throw new Error("Chrome did not start");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  });
  const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  await send("Runtime.enable");
  await send("Page.enable");
  if (HEADLESS) await send("Emulation.setDeviceMetricsOverride", { width: 1536, height: 864, deviceScaleFactor: 1, mobile: false });
  const evaluate = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? "evaluate failed");
    return r.result?.result?.value;
  };
  return { proc, send, evaluate };
}

// ---------------------------------------------------------------- page helpers
// A soft presenter dot shows viewers where each click happens.
const CURSOR = `(() => { if (document.getElementById("rr-cursor")) return;
  const d = document.createElement("div"); d.id = "rr-cursor";
  d.style.cssText = "position:fixed;z-index:99999;left:-40px;top:-40px;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;pointer-events:none;background:rgba(199,243,107,.35);border:2px solid #c7f36b;box-shadow:0 0 18px rgba(199,243,107,.6);transition:left .55s cubic-bezier(.22,1,.36,1),top .55s cubic-bezier(.22,1,.36,1),transform .15s";
  document.body.appendChild(d); })()`;

function helpers(page) {
  const { evaluate, send } = page;
  const find = (js) => `(() => { const el = ${js}; if (!el) return null; el.scrollIntoView({ block: "nearest", behavior: "instant" }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`;
  const byText = (re, scope = "document") => `[...${scope}.querySelectorAll("button, a, [role=radio]")].find(b => ${re}.test(b.textContent.trim()) && !b.disabled && b.offsetParent)`;
  const h = {
    async ensureCursor() {
      await evaluate(CURSOR);
    },
    async pointTo(x, y) {
      await h.ensureCursor();
      await evaluate(`(() => { const d = document.getElementById("rr-cursor"); d.style.left = "${x}px"; d.style.top = "${y}px"; })()`);
      await sleep(600);
    },
    async press() {
      await evaluate(`(() => { const d = document.getElementById("rr-cursor"); d.style.transform = "scale(.7)"; setTimeout(() => d.style.transform = "", 160); })()`);
    },
    /** Moves the dot to the element, then clicks it. `js` evaluates to the element. */
    async clickEl(js, label) {
      const p = await evaluate(find(js));
      if (!p) throw new Error(`not found: ${label}`);
      await h.pointTo(p.x, p.y);
      await h.press();
      await evaluate(`(${js}).click()`);
      await sleep(250);
    },
    click: (re, scope, label) => h.clickEl(byText(re, scope), label ?? String(re)),
    async goto(url) {
      await send("Page.navigate", { url });
      await sleep(2500);
    },
    async scrollToText(re, offset = 90) {
      const ok = await evaluate(`(() => { const el = [...document.querySelectorAll("h1,h2,h3,p,figcaption")].find(e => ${re}.test(e.textContent)); if (!el) return false; window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - ${offset}, behavior: "smooth" }); return true; })()`);
      if (!ok) throw new Error(`no heading ${re}`);
      await sleep(1400);
    },
    async scrollBy(dy) {
      await evaluate(`window.scrollBy({ top: ${dy}, behavior: "smooth" })`);
      await sleep(900);
    },
    async waitFor(js, timeout = 60000) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        if (await evaluate(`!!(${js})`)) return true;
        await sleep(250);
      }
      throw new Error(`timed out waiting for ${js}`);
    },
    exists: (re) => evaluate(`!!${byText(re)}`),
    async drag(x0, y0, dx, steps = 30) {
      await h.pointTo(x0, y0);
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x: x0, y: y0, button: "left", clickCount: 1 });
      for (let i = 1; i <= steps; i++) {
        const x = x0 + (dx * i) / steps;
        await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y: y0, button: "left", buttons: 1 });
        await evaluate(`document.getElementById("rr-cursor").style.left = "${x}px"`);
        await sleep(35);
      }
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x0 + dx, y: y0, button: "left", clickCount: 1 });
    },
    async hoverAcross(js, steps = 24) {
      const r = await evaluate(`(() => { const el = ${js}; const b = el.getBoundingClientRect(); return { x: b.left, y: b.top + b.height / 2, w: b.width }; })()`);
      for (let i = 0; i <= steps; i++) {
        const x = r.x + 70 + ((r.w - 90) * i) / steps;
        await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y: r.y });
        await evaluate(`(() => { const d = document.getElementById("rr-cursor"); d.style.transition = "none"; d.style.left = "${x}px"; d.style.top = "${r.y}px"; })()`);
        await sleep(110);
      }
      await evaluate(`document.getElementById("rr-cursor").style.transition = ""`);
    },
    /** Keeps OBS's window title match working on pages we don't own (GitHub). */
    async pinTitle() {
      await evaluate(`(() => { document.title = ${JSON.stringify(TITLE)}; new MutationObserver(() => { if (document.title !== ${JSON.stringify(TITLE)}) document.title = ${JSON.stringify(TITLE)}; }).observe(document.querySelector("title") ?? document.head, { childList: true, subtree: true, characterData: true }); })()`);
    },
  };
  return h;
}

// ---------------------------------------------------------------- the live Wireshark capture
let pcap = null;
function captureLab() {
  return new Promise((res) => {
    const p = spawn(PYTHON, ["lab/run_experiment.py", "--objects", "5", "--rtt", "0", "--reps", "1"], { cwd: ROOT });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("close", () => {
      const m = out.match(/capture (lab[\\/]out[\\/]capture-[^\s]+\.pcapng)/);
      pcap = m ? join(ROOT, m[1]) : newestPcap();
      console.log(`${C.dim}lab capture ready: ${pcap ?? "none"}${C.r}`);
      res(pcap);
    });
  });
}
function newestPcap() {
  const dir = join(ROOT, "lab", "out");
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).filter((n) => n.endsWith(".pcapng")).map((n) => join(dir, n)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return f[0] ?? join(ROOT, "evidence", "capture-20261022-203701.pcapng");
}
let wireshark = null;

// ---------------------------------------------------------------- segment demos
// setup runs while recording is paused; run is what viewers see.
const RES = () => `${SITE}#/results`;
const LAB = () => `${SITE}#/lab`;
const tourBtn = (re) => `[...document.querySelectorAll("button")].find(b => ${re}.test(b.textContent) && !b.disabled)`;

const DEMOS = {
  1: {
    async setup(h, page) {
      // load the site first: its saved settings can only be set from its own page
      await h.goto(RES());
      await page.evaluate(`localStorage.setItem("reuse-reconnect:theme","dark"); localStorage.setItem("reuse-reconnect:voice","off"); localStorage.setItem("reuse-reconnect:tour-done","1"); true`);
      await h.goto(RES());
      await page.evaluate(`window.scrollTo(0, 0)`);
      await sleep(2500);
    },
    async run() {
      await sleep(4000);
    },
  },
  2: {
    async setup(h) {
      await h.scrollToText(/^Glossary$/, 140);
    },
    async run(h) {
      const flip = (t) => h.clickEl(`[...document.querySelectorAll(".flip")].find(b => b.textContent.startsWith(${JSON.stringify(t)}))`, t);
      await sleep(11000);
      await flip("Handshake");
      await sleep(6000);
      await flip("SYN");
      await sleep(11000);
      await flip("RTT");
      await sleep(14000);
      await flip("Keep-Alive");
      await sleep(13000);
      await h.scrollToText(/^Sequence diagrams/, 90);
      const card = `[...document.querySelectorAll("p")].find(p => /^Sequence diagrams/.test(p.textContent)).closest(".cyber")`;
      await h.click(/^3$/, card);
      await h.click(/^50 ms$/, card);
      await sleep(1500);
      await h.click(/Play the packets/, card);
      await sleep(22000);
      await h.scrollToText(/^The formula, with your numbers/, 140);
      await sleep(8000);
    },
  },
  3: {
    async setup(h, page) {
      await page.evaluate(`localStorage.removeItem("reuse-reconnect:tour-done"); localStorage.setItem("reuse-reconnect:voice","off"); true`);
      await h.goto(LAB());
      await h.waitFor(tourBtn(/Start lesson 1/));
      await sleep(1500);
    },
    async run(h) {
      await sleep(20000);
      await h.click(/Start lesson 1/);
      for (const lesson of [1, 2]) {
        await sleep(2500);
        for (let i = 0; i < 30; i++) {
          if (await h.exists(/^Next lesson/)) break;
          await h.waitFor(`${tourBtn(/Send the first packet|Next packet|Next lesson/)}`);
          if (await h.exists(/^Next lesson/)) break;
          await h.click(/Send the first packet|Next packet/);
          await sleep(lesson === 1 ? 4200 : 4600);
        }
        await sleep(4000);
        await h.click(/^Next lesson/);
      }
      await sleep(5000);
      await h.click(/Start the race/);
      await h.waitFor(tourBtn(/^Next/));
      await sleep(9000);
      await h.click(/^Next/);
      await sleep(3000);
    },
  },
  4: {
    async setup(h) {
      if (await h.exists(/Start exploring/)) await h.click(/Start exploring/);
      await sleep(2000);
    },
    async run(h) {
      const files = `[...document.querySelectorAll("[aria-label='File presets'] button")]`;
      await sleep(3000);
      await h.clickEl(`${files}.find(b => b.textContent.trim() === "40")`, "40 files");
      await h.click(/Other country/);
      await sleep(1500);
      await h.click(/Start race|Run again/);
      await h.waitFor(`document.querySelector("[aria-label='Close result']")`);
      await sleep(9000);
      await h.clickEl(`document.querySelector("[aria-label='Close result']")`, "close result");
      await h.clickEl(`${files}.find(b => b.textContent.trim() === "1")`, "1 file");
      await sleep(1000);
      await h.click(/Start race|Run again/);
      await h.waitFor(`document.querySelector("[aria-label='Close result']")`);
      await sleep(6000);
      await h.clickEl(`document.querySelector("[aria-label='Close result']")`, "close result");
      await h.clickEl(`[...document.querySelectorAll("button[aria-pressed]")].find(b => /Panels/.test(b.textContent))`, "panels");
      await sleep(1500);
      await h.drag(1000, 450, -380);
      await sleep(800);
      await h.drag(700, 450, 520);
      await sleep(2500);
      await h.clickEl(`[...document.querySelectorAll("button")].find(b => /Show panels/.test(b.textContent))`, "show panels");
      await sleep(1500);
    },
  },
  5: {
    async setup(h, page) {
      await h.goto(RES());
      await page.evaluate(`window.scrollTo(0, 0)`);
      await sleep(1500);
    },
    async run(h) {
      const hero = `document.querySelector("[aria-label='Files on the web page']").closest(".cyber")`;
      await sleep(2000);
      await h.clickEl(`[...${hero}.querySelectorAll("[role=radio]")].find(b => b.textContent.trim() === "40")`, "40");
      await h.clickEl(`[...${hero}.querySelectorAll("[role=radio]")].find(b => b.textContent.trim() === "100 ms")`, "100 ms");
      await sleep(26000);
      await h.scrollToText(/^Page load time vs number of files/, 120);
      await sleep(3000);
      await h.hoverAcross(`[...document.querySelectorAll("figure svg")].find(s => s.closest("figure").textContent.includes("Page load time vs number"))`);
      await sleep(8000);
      await h.scrollToText(/^TCP handshakes vs number of files/, 120);
      await sleep(14000);
      await h.scrollToText(/^The formula, with your numbers/, 140);
      await sleep(10000);
    },
  },
  6: {
    async setup(h) {
      const lab = captureLab(); // a fresh 5-file capture for Wireshark, made off camera
      await h.goto(RES());
      await h.scrollToText(/^Real proof: Python \+ Wireshark/, 80);
      await lab;
    },
    async run(h) {
      const proof = `[...document.querySelectorAll("section")].find(s => /Real proof/.test(s.textContent))`;
      await sleep(7000);
      await h.click(/^50 ms$/, proof);
      await sleep(52000);
      if (pcap) {
        wireshark = spawn(WIRESHARK, ["-r", pcap, "-Y", "tcp.flags.syn==1 && tcp.flags.ack==0"], { detached: true, stdio: "ignore" });
        await sleep(9000);
        await scene(SCENE_WS);
      }
      await sleep(30000);
    },
    async teardown() {
      await scene(SCENE_WEB);
      if (wireshark) {
        try {
          process.kill(wireshark.pid);
        } catch {
          /* already closed */
        }
        wireshark = null;
      }
    },
  },
  7: {
    async setup(h) {
      await h.goto(VIDEO.repo);
      await h.pinTitle();
      await sleep(1500);
    },
    async run(h) {
      await sleep(9000);
      for (let i = 0; i < 6; i++) {
        await h.scrollBy(380);
        await sleep(5500);
      }
    },
  },
  8: {
    async setup(h, page) {
      await h.goto(RES());
      await page.evaluate(`window.scrollTo(0, 0)`);
      await sleep(2500);
    },
    async run() {
      await sleep(6000);
    },
  },
};

// ---------------------------------------------------------------- teleprompter window
// A tiny local server feeds the teleprompter page live (server-sent events);
// its buttons post back here. The window is titled "Teleprompter", so OBS's
// title-matched capture never records it.
const prompter = { clients: new Set(), state: { phase: "ready", total: 0 }, cmd: { hold: false, next: false } };
function publish(patch) {
  Object.assign(prompter.state, patch);
  const msg = `data: ${JSON.stringify(prompter.state)}\n\n`;
  for (const c of prompter.clients) c.write(msg);
}
let startPressed;
const started = new Promise((r) => (startPressed = r));
function startPrompterServer() {
  const html = readFileSync(join(ROOT, "tools", "video", "teleprompter.html"));
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/events") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      res.write(`data: ${JSON.stringify(prompter.state)}\n\n`);
      prompter.clients.add(res);
      req.on("close", () => prompter.clients.delete(res));
    } else if (url.pathname === "/control" && req.method === "POST") {
      const cmd = url.searchParams.get("cmd");
      if (cmd === "start") startPressed();
      if (cmd === "hold") prompter.cmd.hold = !prompter.cmd.hold;
      if (cmd === "next") prompter.cmd.next = true;
      res.end("ok");
    } else {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    }
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r(server.address().port)));
}
const TOPMOST_PS = [
  "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class W { [DllImport(\"user32.dll\")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f); }';",
  "for ($i = 0; $i -lt 20; $i++) {",
  "  $p = Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -eq 'Teleprompter' } | Select-Object -First 1;",
  "  if ($p) { [W]::SetWindowPos($p.MainWindowHandle, [IntPtr](-1), 0, 0, 0, 0, 3) | Out-Null; break };",
  "  Start-Sleep -Milliseconds 500",
  "}",
].join(" ");
function launchPrompter(port) {
  const profile = join(ROOT, "tools", "video", ".prompter-profile");
  mkdirSync(profile, { recursive: true });
  // top centre of the screen, right under the webcam, so your eyes stay near the camera
  const proc = spawn(CHROME, [`--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--window-size=860,330", "--window-position=210,0", `--app=http://127.0.0.1:${port}/`], { stdio: "ignore" });
  // keep it above the full-screen browser and Wireshark
  setTimeout(() => spawn("powershell", ["-NoProfile", "-Command", TOPMOST_PS], { stdio: "ignore" }), 1500);
  return proc;
}
const countWords = (t) => t.split(/\s+/).filter(Boolean).length;
function speechPlan(seg) {
  const per = seg.say.map(countWords);
  const total = per.reduce((a, b) => a + b, 0);
  return { speechMs: Math.round((total / WORDS_PER_SEC + 2.5) * 1000 * PACE), weights: per.map((w) => w / total) };
}

// ---------------------------------------------------------------- main
async function main() {
  console.log(`${C.b}${C.lime}Recording autopilot · ${VIDEO.title}${C.r}`);
  console.log(`${C.dim}site ${SITE}   ${DRY ? "DRY RUN (no OBS)" : "OBS on"}   starting at segment ${FROM}${C.r}`);
  if (obs) {
    await obs.connect();
    await obs.setup();
    console.log(`${C.lime}OBS connected; scenes "${SCENE_WEB}" and "${SCENE_WS}" are ready.${C.r}`);
    if (flag("--obs-check")) {
      const v = await obs.call("GetVersion");
      const vs = await obs.call("GetVideoSettings");
      const rec = await obs.call("GetRecordDirectory");
      const sp = await obs.call("GetSpecialInputs");
      console.log(`OBS ${v.obsVersion} · canvas ${vs.baseWidth}×${vs.baseHeight} → output ${vs.outputWidth}×${vs.outputHeight} @ ${vs.fpsNumerator / vs.fpsDenominator} fps`);
      console.log(`recordings go to: ${rec.recordDirectory}`);
      console.log(`microphone: ${sp.mic1 ?? "none set"} · desktop audio: ${sp.desktop1 ?? "none set"}`);
      process.exit(0);
    }
  }
  const page = await launchChrome();
  const h = helpers(page);
  let recording = false;
  const segs = SEGMENTS.filter((s) => s.n >= FROM && s.n <= TO);

  if (!MANUAL) {
    const port = await startPrompterServer();
    publish({ phase: "ready", total: SEGMENTS.length });
    const prompterProc = HEADLESS ? null : launchPrompter(port);
    console.log(`${C.dim}teleprompter: http://127.0.0.1:${port}/${C.r}`);
    console.log(`${C.lime}Teleprompter window is open (it is not recorded). Click "Start recording" in it, or press Enter here.${C.r}`);
    await (DRY ? Promise.resolve() : Promise.race([started, enter("")]));
    for (const seg of segs) {
      const demo = DEMOS[seg.n];
      const plan = speechPlan(seg);
      publish({ phase: "preparing", seg });
      await demo.setup(h, page);
      for (const count of [3, 2, 1]) {
        publish({ phase: "countdown", seg, count });
        await sleep(DRY ? 100 : 1000);
      }
      if (obs) {
        if (!recording) {
          await obs.call("StartRecord");
          recording = true;
        } else await obs.call("ResumeRecord");
      }
      console.log(`${C.lime}● recording segment ${seg.n} · ${seg.title}${C.r}`);
      prompter.cmd.hold = false;
      prompter.cmd.next = false;
      let demoDone = false;
      demo
        .run(h, page)
        .catch((e) => console.log(`${C.red}demo step failed: ${e.message}${C.r}`))
        .finally(() => (demoDone = true));
      let elapsed = 0;
      let last = Date.now();
      publish({ phase: "recording", seg, ...plan, elapsed, hold: false, demoDone });
      // The segment ends once the reading time is up (or Next is pressed) and the demo has finished.
      for (;;) {
        await sleep(250);
        const now = Date.now();
        if (!prompter.cmd.hold) elapsed += now - last;
        last = now;
        publish({ elapsed, hold: prompter.cmd.hold, demoDone });
        if (demoDone && (prompter.cmd.next || (elapsed >= plan.speechMs && !prompter.cmd.hold))) break;
      }
      await sleep(DRY ? 0 : 900); // a breath before the cut
      if (SHOTS) {
        mkdirSync(SHOTS, { recursive: true });
        const { result } = await page.send("Page.captureScreenshot", { format: "png" });
        writeFileSync(join(SHOTS, `segment-${seg.n}.png`), Buffer.from(result.data, "base64"));
      }
      if (obs && seg !== segs.at(-1)) await obs.call("PauseRecord");
      if (demo.teardown) await demo.teardown();
    }
    let message = "Dry run finished.";
    if (obs && recording) {
      const { outputPath } = await obs.call("StopRecord");
      message = `Saved to ${outputPath}. Upload it to YouTube as Unlisted.`;
    }
    publish({ phase: "finished", message });
    console.log(`\n${C.b}${C.lime}${message}${C.r}`);
    await sleep(DRY ? 0 : 5000);
    rl.close();
    page.proc.kill();
    if (prompterProc) prompterProc.kill();
    process.exit(0);
  }

  for (const seg of segs) {
    const demo = DEMOS[seg.n];
    teleprompter(seg);
    await enter(`Press Enter to START segment ${seg.n}${recording ? " (recording resumes)" : " (recording starts)"}… `);
    await demo.setup(h, page);
    if (obs) {
      if (!recording) {
        await obs.call("StartRecord");
        recording = true;
      } else await obs.call("ResumeRecord");
    }
    console.log(`${C.lime}● recording segment ${seg.n} — read the lines above${C.r}`);
    const shown = demo.run(h, page).catch((e) => console.log(`${C.red}demo step failed: ${e.message}${C.r}`));
    await Promise.all([shown, enter(`Press Enter when you have finished speaking… `)]);
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      const { result } = await page.send("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(SHOTS, `segment-${seg.n}.png`), Buffer.from(result.data, "base64"));
    }
    if (obs && seg.n !== SEGMENTS.at(-1).n) await obs.call("PauseRecord");
    if (demo.teardown) await demo.teardown();
    console.log(`${C.dim}segment ${seg.n} done${C.r}`);
  }

  if (obs && recording) {
    const { outputPath } = await obs.call("StopRecord");
    console.log(`\n${C.b}${C.lime}Recording saved: ${outputPath}${C.r}`);
    console.log("Upload it to YouTube as Unlisted and put the link in your submission.");
  } else console.log(`\n${C.lime}Dry run finished.${C.r}`);
  rl.close();
  page.proc.kill();
  process.exit(0);
}

main().catch((e) => {
  console.error(`${C.red}${e.message}${C.r}`);
  process.exit(1);
});
