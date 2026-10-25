// Builds docs/Video-Script.pdf from script.mjs: HTML laid out for print, rendered by headless Chrome.
//   node tools/video/make-pdf.mjs
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { RUBRIC, SEGMENTS, VIDEO } from "./script.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "docs", "Video-Script.pdf");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const secs = (t) => t.split(":").reduce((a, v) => a * 60 + Number(v), 0);
const dur = (s) => {
  const d = secs(s.end) - secs(s.start);
  return `${Math.floor(d / 60)}:${String(d % 60).padStart(2, "0")}`;
};
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// [placeholders] are highlighted so they are not read out by mistake
const words = (t) => esc(t).replace(/\[([^\]]+)\]/g, '<mark>[$1]</mark>');
const wordCount = (s) => s.say.join(" ").split(/\s+/).length;

const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(VIDEO.title)} · video script</title>
<style>
  @page { size: A4; margin: 16mm 16mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Inter, Arial, sans-serif; color: #111827; font-size: 10.5pt; line-height: 1.5; margin: 0; }
  h1 { font-size: 22pt; margin: 0 0 2mm; letter-spacing: -0.01em; }
  .sub { color: #4b5563; margin: 0 0 6mm; }
  .meta { display: grid; grid-template-columns: 34mm 1fr; gap: 1.5mm 4mm; margin: 0 0 6mm; font-size: 10pt; }
  .meta b { color: #374151; }
  h2 { font-size: 13pt; margin: 7mm 0 2.5mm; padding-bottom: 1.5mm; border-bottom: 1.5px solid #e5e7eb; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; break-inside: avoid; }
  h2 { break-after: avoid; }
  .keep { break-inside: avoid; }
  th { text-align: left; background: #f3f4f6; padding: 2mm 2.5mm; font-weight: 600; }
  td { padding: 2mm 2.5mm; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  ol.steps { margin: 0; padding-left: 5mm; }
  ol.steps li { margin: 1mm 0; }
  .note { background: #fffbeb; border-left: 3px solid #f59e0b; padding: 2.5mm 3.5mm; margin: 3mm 0; font-size: 9.5pt; }
  .seg { break-before: page; }
  .seg-head { display: flex; align-items: baseline; gap: 4mm; background: #0f172a; color: #fff; padding: 3mm 4mm; border-radius: 2mm; }
  .seg-head .time { font-family: Consolas, monospace; font-size: 15pt; font-weight: 700; color: #a3e635; }
  .seg-head .t { font-size: 14pt; font-weight: 700; }
  .seg-head .r { margin-left: auto; font-size: 8.5pt; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.08em; }
  .screen { margin: 3mm 0 4mm; font-size: 9.5pt; color: #374151; }
  .screen b { color: #0e7490; }
  .screen li { margin: 0.5mm 0; }
  .say p { font-size: 13.5pt; line-height: 1.6; margin: 0 0 4mm; }
  mark { background: #fde68a; padding: 0 1mm; border-radius: 1mm; }
  .count { font-size: 8.5pt; color: #6b7280; margin-top: -1mm; }
</style></head><body>
<h1>${esc(VIDEO.title)}</h1>
<p class="sub">${esc(VIDEO.subtitle)} · ${esc(VIDEO.course)}</p>
<div class="meta">
  <b>Video length</b><span>${esc(VIDEO.length)}</span>
  <b>Live site</b><span>${esc(VIDEO.site)}</span>
  <b>Code</b><span>${esc(VIDEO.repo)}</span>
  <b>Presenter</b><span><mark>[your name]</mark> · student ID <mark>[your ID]</mark></span>
</div>

<h2>How to record (hands-free: you only read)</h2>
<ol class="steps">
  <li>Open <b>OBS Studio</b> once and leave it open. The autopilot creates its scenes and starts, pauses and stops the recording by itself.</li>
  <li>In a terminal in the project folder, run <code>npm run video</code>. The website opens full-screen and a <b>Teleprompter</b> window appears at the top of the screen, under your webcam.</li>
  <li>Click <b>Start recording</b> in the teleprompter. From then on you only read. The text <b>follows your voice</b>: words you have said turn bright, the next word is highlighted, and it scrolls only when you reach the next line. A segment moves on (after a 3-2-1 countdown) only once you have said its last lines and the demo has finished. The label at the top says <i>follows your voice</i>; if it says <i>timer</i>, voice-follow is unavailable (it needs internet) and a slow timer is used instead.</li>
  <li>Need more time? Press <b>Hold</b> (or Space) and press it again when ready. Finished early? Press <b>Next</b> (or the right arrow key).</li>
  <li>After segment 8 the recording stops and the teleprompter shows where the video is saved. Upload it to YouTube as <b>Unlisted</b>.</li>
</ol>
<div class="note"><b>The teleprompter, this PDF and the terminal are never recorded.</b> OBS records only the website window (and Wireshark in segment 6), plus your face-cam in the bottom-right corner. Speak calmly, about 2 words per second. Fill in the <mark>[highlighted]</mark> words first.</div>

<h2>Rubric coverage (20 marks)</h2>
<table><tr><th>Criterion</th><th class="num">Marks</th><th>Where the video earns it</th></tr>
${RUBRIC.map((r) => `<tr><td>${esc(r.criterion)}</td><td class="num">${r.marks}</td><td>${esc(r.where)}</td></tr>`).join("")}
</table>

<div class="keep"><h2>Timeline</h2>
<table><tr><th>#</th><th>Segment</th><th class="num">Time</th><th class="num">Length</th><th>Rubric</th></tr>
${SEGMENTS.map((s) => `<tr><td>${s.n}</td><td>${esc(s.title)}</td><td class="num">${s.start}–${s.end}</td><td class="num">${dur(s)}</td><td>${esc(s.rubric)}</td></tr>`).join("")}
</table></div>

${SEGMENTS.map(
  (s) => `<section class="seg">
  <div class="seg-head"><span class="time">${s.start}–${s.end}</span><span class="t">${s.n} · ${esc(s.title)}</span><span class="r">${esc(s.rubric)}</span></div>
  <div class="screen"><b>On screen (autopilot):</b><ul>${s.screen.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
  <div class="say">${s.say.map((p) => `<p>${words(p)}</p>`).join("")}</div>
  <p class="count">${wordCount(s)} words · about ${Math.round(wordCount(s) / 2.2)} s of speech in a ${dur(s)} segment</p>
</section>`,
).join("")}
</body></html>`;

const dir = mkdtempSync(join(tmpdir(), "vscript-"));
const htmlPath = join(dir, "script.html");
writeFileSync(htmlPath, html);
mkdirSync(dirname(OUT), { recursive: true });

// Headless Chrome prints the HTML with page numbers in the footer.
const port = 9600 + Math.floor(Math.random() * 300);
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${join(dir, "profile")}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets = [];
for (let i = 0; i < 50 && !targets.length; i++) {
  try {
    targets = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).filter((t) => t.type === "page");
  } catch {
    /* starting */
  }
  await sleep(200);
}
const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) pending.get(m.id)(m.result);
});
const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
await send("Page.enable");
await send("Page.navigate", { url: pathToFileURL(htmlPath).href });
await sleep(1500);
const { data } = await send("Page.printToPDF", {
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: `<div style="width:100%;font-size:8px;color:#6b7280;padding:0 16mm;display:flex;justify-content:space-between;font-family:Segoe UI,Arial"><span>${esc(VIDEO.title)} · video script</span><span>page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
});
writeFileSync(OUT, Buffer.from(data, "base64"));
ws.close();
chrome.kill();
console.log(`wrote ${OUT}`);
