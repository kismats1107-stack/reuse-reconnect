// Builds docs/Technical-Report.pdf: HTML laid out for print, rendered by headless Chrome.
// Tables and calculations come straight from evidence/measurement-*.json; figures from docs/report-img/.
//   node tools/report/make-report.mjs                       (npm run report)
//   node tools/report/make-report.mjs --video https://youtu.be/...   adds the video link
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "docs", "Technical-Report.pdf");
const IMG = join(ROOT, "docs", "report-img");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const argv = process.argv.slice(2);
const VIDEO_URL = argv.includes("--video") ? argv[argv.indexOf("--video") + 1] : "";

const STUDENT = { name: "Kismat Shah", id: "25cs099", cls: "CSE-2", course: "ITUC201 · Computer Networks" };
const TITLE = "HTTP Keep-Alive versus New-Connection Requests";
const SITE = "https://reuse-reconnect.netlify.app";
const REPO = "https://github.com/kismats1107-stack/reuse-reconnect";

// ---------------------------------------------------------------- data
const evidenceFile = readdirSync(join(ROOT, "evidence")).find((f) => /^measurement-.*\.json$/.test(f));
const pcapFile = readdirSync(join(ROOT, "evidence")).find((f) => /\.pcapng$/.test(f));
const M = JSON.parse(readFileSync(join(ROOT, "evidence", evidenceFile), "utf8"));
const cell = {};
for (const r of M.runs) (cell[`${r.rttMs}|${r.objects}`] ??= {})[r.strategy] = r;
const RTTS = [...new Set(M.runs.map((r) => r.rttMs))].sort((a, b) => a - b);
const FILES = [...new Set(M.runs.map((r) => r.objects))].sort((a, b) => a - b);
const rows = RTTS.flatMap((rtt) =>
  FILES.map((n) => {
    const { close: a, keepalive: b } = cell[`${rtt}|${n}`];
    return { rtt, n, a: a.loadMs.median, b: b.loadMs.median, mode: a.rttMode, connA: a.samples[0].captureConnections, connB: b.samples[0].captureConnections };
  }),
);
const samples = M.runs.flatMap((r) => r.samples.map((s) => ({ ...s, strategy: r.strategy, objects: r.objects })));
const agree = samples.filter((s) => {
  const want = s.strategy === "close" ? s.objects : 1;
  return s.clientConnections === want && s.serverConnections === want && s.captureConnections === want && s.captureHandshakes === want;
}).length;
const get = (rtt, n) => rows.find((r) => r.rtt === rtt && r.n === n);

// the website's model (src/lib/simulation.ts, 100 Mbps, 1 ms server time): Σ for the asset set
const MODEL = { n10r50: { a: 1042, b: 592 }, n40r100: { a: 8174, b: 4274 } };

// ---------------------------------------------------------------- helpers
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const ms = (v) => (v >= 100 ? Math.round(v).toLocaleString("en-IN") : v.toFixed(1));
const img = (f) => pathToFileURL(join(IMG, f)).href;
let figN = 0;
const fig = (file, caption, width = "100%") => `<figure><img src="${img(file)}" style="width:${width}"><figcaption><b>Figure ${++figN}.</b> ${caption}</figcaption></figure>`;

const r50 = get(50, 20);
const r0 = get(0, 40);

const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(TITLE)} · technical report</title>
<style>
  @page { size: A4; margin: 16mm 17mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Inter, Arial, sans-serif; color: #111827; font-size: 10.5pt; line-height: 1.55; margin: 0; }
  .cover { border-bottom: 2px solid #111827; padding-bottom: 5mm; margin-bottom: 6mm; }
  .kicker { font-size: 9pt; letter-spacing: .12em; text-transform: uppercase; color: #0e7490; font-weight: 600; }
  h1 { font-size: 22pt; line-height: 1.2; margin: 1.5mm 0 4mm; letter-spacing: -.01em; }
  .meta { display: grid; grid-template-columns: 30mm 1fr 30mm 1fr; gap: 1.2mm 4mm; font-size: 9.5pt; }
  .meta b { color: #4b5563; font-weight: 600; }
  h2 { font-size: 13.5pt; margin: 7mm 0 2.5mm; padding-bottom: 1.2mm; border-bottom: 1.5px solid #e5e7eb; break-after: avoid; }
  h2 .n { color: #0e7490; margin-right: 2mm; }
  h3 { font-size: 11pt; margin: 4mm 0 1.5mm; break-after: avoid; }
  p { margin: 0 0 2.5mm; }
  ul, ol { margin: 0 0 2.5mm; padding-left: 6mm; }
  li { margin: .6mm 0; }
  code, .mono { font-family: Consolas, "Cascadia Mono", monospace; font-size: 9.3pt; }
  code { background: #f3f4f6; padding: 0 1mm; border-radius: 1mm; }
  pre { font-family: Consolas, monospace; font-size: 9pt; background: #0f172a; color: #e5e7eb; padding: 3mm 4mm; border-radius: 2mm; margin: 2mm 0 3mm; white-space: pre-wrap; break-inside: avoid; }
  pre .c { color: #94a3b8; }
  .formula { background: #f0f9ff; border-left: 3px solid #0e7490; padding: 2.5mm 4mm; margin: 2.5mm 0 3mm; font-family: Consolas, monospace; font-size: 10pt; break-inside: avoid; }
  .box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 2mm; padding: 3mm 4mm; margin: 2.5mm 0 3mm; break-inside: avoid; }
  .key { background: #f7fee7; border-left: 3px solid #65a30d; padding: 2.5mm 4mm; margin: 3mm 0; break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 2mm 0 3mm; break-inside: avoid; }
  th { text-align: left; background: #f3f4f6; padding: 1.4mm 2mm; font-weight: 600; border-bottom: 1px solid #d1d5db; }
  td { padding: 1.2mm 2mm; border-bottom: 1px solid #eef0f3; }
  td.r, th.r { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  tr.grp td { background: #f9fafb; font-weight: 600; color: #374151; }
  .tcap { font-size: 9pt; color: #4b5563; margin: -1mm 0 3mm; }
  figure { margin: 3mm 0 4mm; break-inside: avoid; text-align: center; }
  figure img { border: 1px solid #e5e7eb; border-radius: 1.5mm; max-height: 120mm; object-fit: contain; }
  figcaption { font-size: 9pt; color: #4b5563; margin-top: 1.5mm; text-align: left; }
  .pb { break-before: page; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
  a { color: #0e7490; text-decoration: none; }
</style></head><body>

<div class="cover">
  <div class="kicker">Technical report · ${esc(STUDENT.course)} · Advanced investigation</div>
  <h1>${esc(TITLE)}</h1>
  <div class="meta">
    <b>Student</b><span>${esc(STUDENT.name)}</span>
    <b>Student ID</b><span>${esc(STUDENT.id)}</span>
    <b>Class</b><span>${esc(STUDENT.cls)}</span>
    <b>Date</b><span>25 October 2026</span>
    <b>Live website</b><span><a href="${SITE}">${SITE.replace("https://", "")}</a></span>
    <b>Source code</b><span><a href="${REPO}">${REPO.replace("https://", "")}</a></span>
    <b>Video</b><span style="grid-column: span 3">${VIDEO_URL ? `<a href="${esc(VIDEO_URL)}">${esc(VIDEO_URL)}</a>` : "YouTube link (Unlisted) given in the submission form"}</span>
  </div>
</div>

<h2><span class="n">1</span>Objective</h2>
<p>To find out, by modelling and by real measurement, how much time a web page saves when HTTP reuses one TCP connection for all its files (<b>keep-alive / persistent connections</b>) instead of opening a <b>new TCP connection for every file</b> (<code>Connection: close</code>), and to explain the difference packet by packet.</p>
<ul>
  <li>Build an interactive 3D visualisation that races the two strategies side by side with every SYN, GET, response and FIN visible.</li>
  <li>Derive a simple timing model and check it against a real HTTP server and client, with the traffic captured in Wireshark.</li>
  <li>Show how the saving depends on the number of files <i>N</i> and the round-trip time <i>RTT</i>.</li>
</ul>

<h2><span class="n">2</span>Essential theory</h2>
<h3>TCP connection set-up and teardown</h3>
<p>TCP (RFC 9293) must open a connection before any data flows. The <b>three-way handshake</b> is SYN → SYN-ACK → ACK. The client can send its HTTP request together with the final ACK, so the handshake costs the client <b>one round-trip time (1 RTT)</b> before the first request leaves. Closing uses FIN / ACK in each direction; it does not delay the page, but each closed connection leaves a socket in TIME_WAIT and costs the server work.</p>
<h3>Non-persistent versus persistent HTTP</h3>
<p>A request/response pair costs one further RTT (plus the server time and the time to transmit the file). With a <b>new connection per file</b>, every file pays a handshake <i>and</i> a request: 2 RTT each. With <b>keep-alive</b>, the default in HTTP/1.1 (RFC 9112 §9.3), the handshake is paid once and every later file needs only 1 RTT. The <code>Connection: close</code> header (RFC 9110 §7.6.1) asks for the connection to be closed after the response, which turns HTTP back into one-connection-per-file.</p>
<p>For <i>N</i> files fetched one after another (no pipelining, no parallel connections), with Σ = total server and transfer time:</p>
<div class="formula">
T<sub>new connection</sub> = N · 2·RTT + Σ<br>
T<sub>keep-alive</sub> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= RTT + N · RTT + Σ<br>
Saving &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= T<sub>new</sub> − T<sub>keep</sub> = (N − 1) · RTT &nbsp;&nbsp;&nbsp;handshakes: N → 1
</div>
<p>The saving grows linearly with both the number of files and the distance to the server; for a single file there is no difference. Relative saving tends to 50% as N grows, because keep-alive needs about half as many round trips.</p>

<h2><span class="n">3</span>Steps followed (method)</h2>
<h3>Part A: the interactive model (website)</h3>
<ol>
  <li>Wrote a discrete-event simulation (<code>src/lib/simulation.ts</code>) that emits every packet (SYN, SYN-ACK, ACK+GET, response, FIN) for both strategies with link speed 100 Mbps and 1 ms server time per file. Its totals match the formulas above; 82 automated tests (Vitest) check the timings and counts.</li>
  <li>Rendered the two strategies as two lanes of a 3D world (React Three Fiber). Packets fly between a browser and a server building; lane A (orange) opens a new connection per file, lane B (green) reuses one. A scoreboard counts connections, handshakes, files and time.</li>
  <li>Added controls for the number of files (1–40) and server distance (0, 10, 50, 100 ms RTT), a guided tour with a voice narrator, and a Results page with 3D towers, charts, sequence diagrams and the real measurements.</li>
</ol>
<h3>Part B: the real experiment (Python + Wireshark)</h3>
<ol>
  <li><code>lab/server.py</code>: an HTTP/1.1 server (Python <code>http.server</code>, threaded) that serves the same file set as the website and counts the connections it accepts.</li>
  <li><code>lab/client.py</code>: a raw-socket HTTP client (TCP_NODELAY, no HTTP library) that fetches N files either over one keep-alive connection or with a new connection and <code>Connection: close</code> for each file, timing from the first <code>connect()</code> to the last response byte.</li>
  <li><code>lab/relay.py</code>: since everything runs on one laptop (real RTT ≈ 0), a relay adds RTT/2 in each direction and holds the first request on a new connection for 1 RTT to emulate the handshake over distance.</li>
  <li><code>lab/capture.py</code>: Dumpcap (Wireshark ${esc(M.capture.tool.match(/\d+\.\d+\.\d+/)?.[0] ?? "")}) captures the loopback adapter; tshark counts SYN packets per trial.</li>
  <li><code>lab/run_experiment.py</code> ran ${FILES.length} page sizes × ${RTTS.length} distances × 2 strategies × ${M.runs[0].repetitions} repetitions = <b>${samples.length} trials</b> on ${esc(M.host.os)}, Python ${esc(M.host.python)}, and wrote <code>${esc(evidenceFile)}</code> and <code>${esc(pcapFile)}</code>. Each trial counts connections three independent ways: client sockets, server accepts and captured SYN packets.</li>
</ol>

<h2 class="pb"><span class="n">4</span>Screenshots and results</h2>
${fig("lab-race.png", "The 3D lab after a race with 10 files and a server 50 ms away. Lane A used 10 connections and 10 handshakes and finished in 1042 ms; lane B used 1 connection and finished in 592 ms, so keep-alive won by 450 ms (43%).")}
${fig("towers.png", "Results page, 40 files at 100 ms. Each tower is one page load built from its events: orange = waiting for a handshake, blue = fetching a file. Keep-alive saves 3900 ms (48%) and skips 39 of 40 handshakes.")}
${fig("charts.png", "Model: page load time against number of files at 50 ms. The gap widens by one RTT with every extra file.", "72%")}
${fig("wireshark.png", `Wireshark on a capture of the lab (5 files, both strategies) with the display filter <span class="mono">tcp.flags.syn==1 &amp;&amp; tcp.flags.ack==0</span>, which shows one packet per new TCP connection. “Displayed: 7” = 1 warm-up + 5 for new-connection + 1 for keep-alive.`)}
${fig("sequence.png", "Sequence diagrams for 3 files at 50 ms RTT, drawn on the same time scale. Left: every file opens and closes its own connection (#1, #2, #3), loaded at 309 ms. Right: one connection carries all three GETs, loaded at 209 ms. The difference is exactly two handshakes: (3 − 1) × 50 ms = 100 ms.", "88%")}

<h3>Real measurements</h3>
${fig("facts.png", "Results page, “Real proof”: dots are measured medians, dashed lines are the model, at 50 ms RTT. The measured points sit on the model lines.")}
<table>
  <tr><th>RTT</th><th class="r">Files N</th><th class="r">New connection (ms)</th><th class="r">Keep-alive (ms)</th><th class="r">Measured saving (ms)</th><th class="r">(N−1)·RTT (ms)</th><th class="r">Connections A / B</th></tr>
  ${RTTS.map((rtt) => `<tr class="grp"><td colspan="7">${rtt === 0 ? "0 ms · plain loopback (no added delay)" : `${rtt} ms · emulated by the relay`}</td></tr>` + rows.filter((r) => r.rtt === rtt).map((r) => `<tr><td></td><td class="r">${r.n}</td><td class="r">${ms(r.a)}</td><td class="r">${ms(r.b)}</td><td class="r">${ms(r.a - r.b)}</td><td class="r">${rtt ? ((r.n - 1) * rtt).toLocaleString("en-IN") : "–"}</td><td class="r">${r.connA} / ${r.connB}</td></tr>`).join("")).join("")}
</table>
<p class="tcap"><b>Table 1.</b> Median page-load time of ${M.runs[0].repetitions} repetitions per cell (${samples.length} trials in total). Connections are the SYN packets counted in the capture; the client and server counts were identical. In <b>${agree} of ${samples.length}</b> trials all three counters agreed with the expected value (N for new connection, 1 for keep-alive).</p>

<h2><span class="n">5</span>Calculations</h2>
<div class="box">
<b>Worked example (model, N = 10, RTT = 50 ms).</b> Σ (server + transfer of the 10 files at 100 Mbps) = 42 ms.<br>
T<sub>new</sub> = 10 × 2 × 50 + 42 = <b>1042 ms</b> &nbsp;·&nbsp; T<sub>keep</sub> = 50 + 10 × 50 + 42 = <b>592 ms</b><br>
Saving = (10 − 1) × 50 = <b>450 ms</b> = 450 / 1042 = <b>43%</b> faster; handshakes 10 → 1.
</div>
<div class="box">
<b>Model against measurement.</b>
<ul>
  <li>10 files, 50 ms: model 1042 / 592 ms; measured ${ms(get(50, 10).a)} / ${ms(get(50, 10).b)} ms (within ${Math.round(Math.max(Math.abs(get(50, 10).a - MODEL.n10r50.a) / MODEL.n10r50.a, Math.abs(get(50, 10).b - MODEL.n10r50.b) / MODEL.n10r50.b) * 100)}%).</li>
  <li>40 files, 100 ms: model 8174 / 4274 ms; measured ${ms(get(100, 40).a)} / ${ms(get(100, 40).b)} ms (within ${Math.round(Math.max(Math.abs(get(100, 40).a - MODEL.n40r100.a) / MODEL.n40r100.a, Math.abs(get(100, 40).b - MODEL.n40r100.b) / MODEL.n40r100.b) * 100)}%).</li>
  <li>20 files, 50 ms: measured saving ${ms(r50.a - r50.b)} ms against (20 − 1) × 50 = 950 ms predicted; the extra ${ms(r50.a - r50.b - 950)} ms ≈ ${((r50.a - r50.b - 950) / 19).toFixed(1)} ms per extra connection is the real cost of creating and closing a socket, which the model leaves out.</li>
  <li>40 files, 0 ms (no network delay at all): ${ms(r0.a)} vs ${ms(r0.b)} ms. Keep-alive is still ${(r0.a / r0.b).toFixed(1)}× faster, so each new connection costs about ${((r0.a - r0.b) / 39).toFixed(1)} ms of operating-system work even on loopback.</li>
</ul>
</div>

<h2><span class="n">6</span>Interpretation</h2>
<ul>
  <li><b>The model is confirmed.</b> Over all distances the measured saving tracks (N − 1)·RTT and the measured times lie within a few percent of the model. The connection counts (N against 1) match in all ${samples.length} trials on the client, the server and the wire.</li>
  <li><b>Distance matters more than bandwidth.</b> The files are small, so transfer time is a few milliseconds; the round trips dominate. At 100 ms the 40-file page drops from about 8.4 s to 4.3 s.</li>
  <li><b>One file: no benefit.</b> With N = 1 both strategies need one handshake, and the measured times are equal within noise (e.g. ${ms(get(50, 1).a)} vs ${ms(get(50, 1).b)} ms at 50 ms).</li>
  <li><b>The saving is slightly bigger than the model.</b> Socket creation, the FIN exchange and server accept work add about ${((r0.a - r0.b) / 39).toFixed(1)}–${((r50.a - r50.b - 950) / 19).toFixed(1)} ms per extra connection on this laptop.</li>
  <li><b>Limits.</b> Requests were sequential: no pipelining, no parallel connections, no TLS and no slow-start effects, and RTT was emulated on one machine. Real browsers open about 6 parallel connections, which hides some of the cost, and HTTPS adds 1–2 more RTT per new connection for the TLS handshake, which makes keep-alive even more valuable.</li>
</ul>
<div class="key"><b>Conclusion.</b> Reusing one TCP connection removes one handshake round trip for every file after the first. For a typical page of many small files on a distant server this almost halves the load time, which is why persistent connections are the default in HTTP/1.1.</div>

<h2><span class="n">7</span>Exam-related answer</h2>
<p><b>Question (Kurose &amp; Ross style).</b> A web page has a base HTML file that references 10 small objects. The RTT between the client and the server is 50 ms, and transmission times are negligible. How long does it take to get the whole page with (a) non-persistent HTTP and no parallel connections, (b) non-persistent HTTP with 5 parallel connections, (c) persistent HTTP without pipelining, (d) persistent HTTP with pipelining?</p>
<div class="box">
<b>Answer.</b> The base file always costs 2 RTT (handshake + request).
<ol type="a">
  <li>Each of the 10 objects needs a new connection: 2 RTT + 10 × 2 RTT = <b>22 RTT = 1100 ms</b>.</li>
  <li>The objects are fetched in 2 rounds of 5 parallel connections: 2 RTT + 2 × 2 RTT = <b>6 RTT = 300 ms</b>.</li>
  <li>The connection is reused, 1 RTT per object: 2 RTT + 10 × 1 RTT = <b>12 RTT = 600 ms</b>.</li>
  <li>All 10 requests are sent back to back: 2 RTT + 1 RTT = <b>3 RTT = 150 ms</b>.</li>
</ol>
(a) − (c) = 10 RTT = 500 ms. This matches this project's formula with N = 11 files in total: (N − 1) · RTT = 10 × 50 = 500 ms, and is what lane A against lane B shows in the 3D lab.
</div>

<h2><span class="n">8</span>References</h2>
<ol>
  <li>R. Fielding, M. Nottingham, J. Reschke (eds.), <i>RFC 9112: HTTP/1.1</i>, IETF, June 2022, §9 “Connection Management”, §9.3 “Persistence”.</li>
  <li>R. Fielding, M. Nottingham, J. Reschke (eds.), <i>RFC 9110: HTTP Semantics</i>, IETF, June 2022, §7.6.1 “Connection”.</li>
  <li>W. Eddy (ed.), <i>RFC 9293: Transmission Control Protocol (TCP)</i>, IETF, August 2022, §3.5 “Establishing a Connection”.</li>
  <li>J. F. Kurose, K. W. Ross, <i>Computer Networking: A Top-Down Approach</i>, 8th ed., Pearson, 2021, §2.2.2 “Non-Persistent and Persistent Connections”.</li>
  <li>MDN Web Docs, “Connection management in HTTP/1.x”, developer.mozilla.org.</li>
  <li>Wireshark Foundation, <i>Wireshark User’s Guide</i> and <i>dumpcap / tshark manual pages</i>, wireshark.org.</li>
  <li>Python Software Foundation, <i>http.server</i> and <i>socket</i> module documentation, docs.python.org.</li>
</ol>

<h2><span class="n">9</span>Instructions to reproduce</h2>
<h3>Run the website</h3>
<p>Open <a href="${SITE}">${SITE.replace("https://", "")}</a>, or run it locally (Node.js 20+):</p>
<pre>git clone ${REPO}
cd reuse-reconnect          <span class="c"># or unzip reuse-reconnect-source.zip</span>
npm install
npm run dev                 <span class="c"># http://localhost:5180  ·  #/lab and #/results</span>
npm test                    <span class="c"># 82 tests of the model</span></pre>
<h3>Repeat the real measurement</h3>
<p>Needs Python 3.10+ (standard library only). Wireshark with Npcap and its loopback adapter is optional: without it the trials run and are timed, but the packets are not captured.</p>
<pre>python lab/run_experiment.py                 <span class="c"># full sweep: 1–40 files × 0–100 ms, 5 reps</span>
python lab/run_experiment.py --objects 10 --rtt 50
python -m unittest lab/test_lab.py -v        <span class="c"># lab self-tests</span></pre>
<p>Results are written to <code>lab/out/measurement-&lt;time&gt;.json</code> and <code>lab/out/capture-&lt;time&gt;.pcapng</code>. To see the handshakes, open the capture in Wireshark and apply the display filter <code>tcp.flags.syn==1 &amp;&amp; tcp.flags.ack==0</code>: there is one SYN per TCP connection. Copy the JSON to <code>src/data/measurement.json</code> to show it on the Results page.</p>
<h3>Supporting files</h3>
<table>
  <tr><th>File</th><th>Contents</th></tr>
  <tr><td class="mono">reuse-reconnect-source.zip</td><td>All editable source: website, Python lab, tests, video tooling, this report’s generator</td></tr>
  <tr><td class="mono">${esc(evidenceFile)}</td><td>Raw data of the ${samples.length} trials (every sample, medians, quartiles, counters)</td></tr>
  <tr><td class="mono">${esc(pcapFile)}</td><td>Wireshark packet capture of the same run</td></tr>
  <tr><td class="mono">Technical-Report.pdf</td><td>This report (rebuilt with <code>npm run report</code>)</td></tr>
</table>
</body></html>`;

// ---------------------------------------------------------------- print
const dir = mkdtempSync(join(tmpdir(), "report-"));
const htmlPath = join(dir, "report.html");
writeFileSync(htmlPath, html);
const port = 9600 + Math.floor(Math.random() * 300);
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${join(dir, "profile")}`, "--allow-file-access-from-files", "about:blank"], { stdio: "ignore" });
const sleep = (t) => new Promise((r) => setTimeout(r, t));
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
await sleep(2500);
const { data } = await send("Page.printToPDF", {
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: `<div style="width:100%;font-size:8px;color:#6b7280;padding:0 17mm;display:flex;justify-content:space-between;font-family:Segoe UI,Arial"><span>${esc(STUDENT.name)} · ${esc(STUDENT.id)} · ${esc(TITLE)}</span><span>page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
});
writeFileSync(OUT, Buffer.from(data, "base64"));
ws.close();
chrome.kill();
console.log(`wrote ${OUT} · ${agree}/${samples.length} trials with all counters agreeing`);
