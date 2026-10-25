# Reuse / Reconnect

**Live:** https://reuse-reconnect.netlify.app

**HTTP Keep-Alive vs New-Connection Requests**: an interactive 3D Computer Networks lab for students.

> How does connection reuse affect the total number of requests, TCP connections and handshakes, and the time a page needs to load?

## What's inside

| Page | What students do |
|---|---|
| **3D Lab** (`#/lab`) | A 3D world with a browser and a web server. Packets (SYN, SYN-ACK, ACK, GET, 200 OK, FIN) fly between them as labelled objects. Connections are built, glow while open, and are thrown onto a pile when closed. Pick the number of files and the server distance, then race *new connection per file* against *Keep-Alive*. On the first visit a **guided tour** walks through it one packet at a time, in plain words. It can be **read aloud** by a narrator (browser speech), and in **Hands-free** mode it presents itself from start to finish. Challenges, live scoreboards and captions are included, plus toggles for panels and labels. Scroll to zoom (eased), drag to orbit (with inertia). |
| **Results** (`#/results`) | Study page and dashboard. It has KPI tiles and four charts for any setting, a log of every race the student ran, **real measurements** (Python + Wireshark, 200 trials), study notes. It opens with **3D time towers** (one block per handshake or file, height = time) that rebuild when the setting changes. Charts draw themselves in, sequence diagrams have a ▶ Play button, the formula shows the live numbers, and the glossary is flip cards. *Save as PDF* prints it. The page uses eased (Lenis) scrolling, which is off when the system asks for reduced motion. |

A light/dark **theme toggle** (sun/moon button) works on both pages and is remembered.

Every number comes from one deterministic event model, `simulate()` in `src/lib/simulation.ts`. The animation, captions, counters, charts and sequence diagrams all use it, and 81 unit tests check it.

## Run it

```bash
npm install
npm run dev          # http://localhost:5180
npm test             # Vitest: model, narration, challenges
npm run lint
npm run build        # static site in dist/ (npm run preview to check it)
npm run report       # docs/Technical-Report.pdf from evidence/ and docs/report-img/
```

## Deploy

The site is hosted on Netlify (`netlify.toml` holds the build settings). To publish a new version:

```bash
npm run build
npx netlify-cli deploy --prod --dir dist --no-build --site reuse-reconnect
```

The pages use hash routes (`#/lab`, `#/results`), so no redirect rules are needed. Code: https://github.com/kismats1107-stack/reuse-reconnect. GitHub Actions (`.github/workflows/ci.yml`) runs lint, tests and a build on every push.

## Real measurements (Python + Wireshark)

The Results page shows real data from `lab/run_experiment.py`. It uses only the Python standard library:

```bash
python lab/run_experiment.py                         # sweep: 1–40 files × 0/10/50/100 ms, 5 reps, capture if Wireshark is installed
python lab/run_experiment.py --objects 10 --rtt 50 --reps 7
python -m unittest lab/test_lab.py -v
```

- The script starts a real HTTP/1.1 server (`lab/server.py`) and fetches the same files as the 3D lab with a raw-socket client (`lab/client.py`).
- Connections are counted three ways: client sockets, server accepts, and SYN packets captured by dumpcap (`lab/capture.py`).
- RTT > 0 is **emulated** on one laptop by `lab/relay.py`, and is labelled as emulated wherever it appears.
- The script writes `lab/out/measurement-*.json` and `lab/out/capture-*.pcapng`. Open the capture in Wireshark with `tcp.flags.syn==1 && tcp.flags.ack==0` to see one SYN per connection.
- The website bundles one such run as `src/data/measurement.json`. Replace that file with a newer run to update the page.

## The model

Requests are sequential; RTT = round-trip time; N = number of files.

| | Connections | Handshakes | Load time |
|---|---|---|---|
| New connection | N | N | N × 2·RTT + Σ(server + transfer) |
| Keep-Alive | 1 | 1 | RTT + N × RTT + Σ(server + transfer) |

**Saving = (N − 1) × RTT.** Constants: 1 ms server time per file and a 100 Mbit/s link. File sizes come from `shared/assets.json`, which the Python lab also uses.

## Structure

```
src/
  app/App.tsx               pages, top bar, toggles, run history
  components/scene/         3D world (React Three Fiber): Scene, Lane, Buildings, Cable, PacketMesh, Label, FloorLine
  components/hud/           Scoreboard, Captions, ControlDock, ResultPanel, Tour, Legend
  components/results/       ResultsPage, Overview, RunHistory, RealMeasurement, StudyNotes, SequenceDiagram, charts
  hooks/useExperiment.ts    playback clock (play, pause, step, play-to)
  lib/                      simulation, metrics, connections, narration, challenges, history, summary, format
  data/measurement.json     real results from the Python lab
shared/assets.json          the example web page's files (both model and lab)
lab/                        Python + Wireshark measurement companion
```
