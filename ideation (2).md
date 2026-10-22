# IDEATION --- HTTP Keep-Alive vs New TCP Connections

## React-based interactive networking experiment

**Project type:** Computer Networks visual experiment\
**Working title:** `REUSE / RECONNECT`\
**Core question:** How does reusing a TCP connection change connection
count, handshake overhead, and the time needed to fetch multiple web
objects?\
**Product format:** One polished, responsive, interactive webpage ---
not a multi-page theory portal.

------------------------------------------------------------------------

## 1. The product vision

Build a compact, visually memorable web experience that lets someone
*see and test* the cost of repeatedly opening TCP connections versus
reusing one persistent connection.

The website should feel like an interactive cyber-lab or a premium
technical product landing page. It should combine a cinematic first
impression with a working experiment. Every visual effect must help
explain the network behaviour; avoid decorative animation that competes
with the experiment.

The user should be able to: 1. Choose how many assets a page needs. 2.
Switch between `Connection: close` and `Keep-Alive`. 3. run both modes
under the same conditions. 4. Watch TCP connections and HTTP requests
animate across a network path. 5. Compare measured/simulated connection
counts, handshake counts, and elapsed time. 6. Understand the result in
a short plain-language conclusion.

### Non-negotiable product rules

-   One-page experience with anchor navigation and scroll storytelling.
-   React-first architecture, broken into manageable components.
-   Interactive experiment is the main feature; theory is short and
    contextual.
-   Clearly label simulated values versus real measured values.
-   Do not invent experiment results or present illustrative values as
    captured measurements.
-   The page must still work if packet-capture tools are not installed.
-   No login, database, account system, or unnecessary backend
    dashboard.
-   Responsive, accessible, and usable with reduced-motion preferences.

------------------------------------------------------------------------

## 2. Inspiration analysis: what to borrow and what to improve

Reference repository: https://github.com/Heet-P/COA_Project

The reference is a computer-architecture project that uses an animated
technical environment, a live HUD, moving elements, and an interrupt
event to make an abstract system feel tangible. Its useful lesson is not
to copy its factory, controls, or exact visual treatment. It is that **a
technical concept becomes easier to understand when the system has
visible state, moving signals, and an event the user can trigger**.

### Translate that lesson into this project

-   Replace factory conveyors with a client, network link, and HTTP
    server.
-   Replace CPU instruction blocks with request/response packets and TCP
    connection paths.
-   Replace the interrupt event with a user-triggered comparison run.
-   Replace register HUD values with connection count, SYN/ACK
    handshakes, request count, and elapsed time.
-   Replace a walkable 3D world with a focused 2D/vector network scene.
    A first-person world is unnecessary for this experiment and risks
    distracting from the evidence.

### The improved direction

Use a deliberate editorial landing page plus one high-quality
interactive network stage. The result should feel more polished and
easier to operate than a complex 3D world, while remaining visually
distinctive.

------------------------------------------------------------------------

## 3. Visual identity

### Creative direction

**Cyber vector lab × editorial typography × cinematic scroll.**

Aim for a technical, confident, clean interface --- not a generic admin
dashboard, hacker movie cliché, or neon-filled gaming UI.

### Palette

Use a deep ink/near-black base with restrained electric cyan and
acid-lime accents, plus warm off-white text. Use red/orange only to
distinguish a new-connection cost or a warning state. The visual
hierarchy must remain readable.

Suggested tokens: - Background: `#080B12` - Surface: `#101722` -
Elevated surface: `#151F2D` - Main text: `#F3F6FA` - Muted text:
`#9BA9BB` - Cyan: `#54D9F5` - Lime: `#C7F36B` - Reconnect accent:
`#FF9466` - Borders: translucent cool grey

These are starting tokens, not a reason to force every component into
the same colours. Keep bright accents scarce and purposeful.

### Typography

-   Display: a strong modern grotesk such as Space Grotesk.
-   Body/UI: Inter or a system sans-serif.
-   Technical labels: IBM Plex Mono or a system monospace.
-   Use large, short headlines and compact metadata. Avoid long
    paragraphs.

### Shape language

-   **Cyber vector cards:** angular corner cuts, fine technical borders,
    grid details, tiny labels, signal paths, and clean hover states.
    Keep cards readable and avoid excessive clipping.
-   **G-shaped framing:** create a custom open rectangular/G-inspired
    frame using CSS borders or SVG paths. It should frame the hero
    network graphic and reappear subtly around the experiment stage. It
    is a signature motif, not a literal giant letter placed everywhere.
-   **Network vectors:** SVG lines, nodes, arrowheads, small packet
    blocks, connection rails, and restrained glow.
-   **Depth:** layered backgrounds, soft radial light, fine grid/noise
    texture made with CSS where practical. Avoid large stock photos.

### Motion principles

-   Motion should clarify direction, state, and cause/effect.
-   Use short, smooth transitions; keep packet travel paths consistent.
-   Respect `prefers-reduced-motion`.
-   Do not lock scrolling, hijack the wheel, or force the user through a
    long animation.
-   Do not make core information depend on animation alone.

------------------------------------------------------------------------

## 4. One-page experience map

### Section A --- Hero: "One page. Two ways to connect."

**Purpose:** communicate the question in five seconds and invite
interaction.

Layout: - Small eyebrow: `NETWORK LAB / EXPERIMENT 01` - Large headline:
`Reuse the connection. Lose the overhead.` - One-line explanation:
"Compare a fresh TCP connection for every object with one persistent
connection reused across the page." - Primary CTA:
`Run the experiment` - Secondary CTA: `See how it works` - Right/central
visual: client and server nodes inside the signature G-frame. One route
repeatedly opens/closes; another remains alive and carries multiple
request/response packets. - Tiny status line: `LOCAL SIMULATION READY`

Scroll behaviour: - The G-frame and network route gently scale/zoom as
the user scrolls toward the experiment. - Headline and supporting labels
move at different, subtle rates for depth. - Keep the hero compact
enough that the experiment is not buried.

### Section B --- The two modes

**Purpose:** establish the comparison without a theory wall.

Two cyber vector cards: 1. **NEW CONNECTION** - Each object opens a new
TCP connection. - Visual: repeated SYN → SYN-ACK → ACK, then
request/response, then close. - Tag: `Connection: close` 2.
**KEEP-ALIVE** - Multiple HTTP requests reuse a persistent TCP
connection. - Visual: one handshake followed by multiple
request/response exchanges. - Tag: `Persistent connection`

Each card should have a small animated vector diagram and a short,
plain-language caption. Use a "same payload, different connection
strategy" note to reinforce fairness.

### Section C --- Interactive experiment stage

**This is the core of the whole product.**

Create a wide, high-contrast lab panel with the network visualization on
top and controls/results integrated beneath or beside it.

Controls: - Object count: slider or segmented options (e.g. 1, 5, 10,
20, 40). - Network RTT: `0 ms`, `10 ms`, `50 ms`, `100 ms`. - Mode:
`Compare both`, `New connection`, `Keep-Alive`. - Optional advanced
toggle: sequential vs. small parallel batch. Keep it off by default and
implement only if the basic experiment is reliable. - Main button:
`Run comparison` - Secondary button: `Reset`

Visualization: - Three primary zones: `CLIENT`, `NETWORK`,
`HTTP SERVER`. - Show connection creation, handshake packets, HTTP
request/response exchanges, and connection close/reuse. - For new
connections, each object visibly creates a new connection path or
reactivates a path with a clearly distinct connection ID. - For
Keep-Alive, one connection ID persists while multiple request/response
exchanges travel through it. - Include a compact event log with
timestamps and labels such as `SYN`, `SYN-ACK`, `ACK`, `GET /asset-03`,
`200 OK`, `FIN`. - Use clear play, pause, replay, and step controls if
feasible; `Run comparison` must work without requiring the user to
understand packet jargon.

Animation sequence: 1. Start in an idle state with client and server
connected visually but no active requests. 2. On run, show connection
establishment. 3. Animate request and response events in order. 4.
Update counters as events occur, not only after the animation. 5. End
with a concise verdict and allow immediate replay with another setting.

### Section D --- Live result comparison

**Purpose:** make the outcome easy to evaluate.

Display paired result cards for `NEW CONNECTION` and `KEEP-ALIVE`: - TCP
connections opened - TCP three-way handshakes - HTTP requests
completed - Total elapsed time / simulated completion time - Estimated
time saved and percentage difference, when mathematically meaningful

Use animated number transitions sparingly. Add a small comparison chart
with a clear baseline and units. Avoid charts that need a statistics
background to read.

A one-sentence dynamic finding should be generated from the current run,
for example: \> "With 20 objects at 50 ms RTT, reusing the connection
reduces repeated handshake setup."

The sentence must be based on the active model/run, not hard-coded as a
universal result.

### Section E --- "What actually happened?"

A short, expandable explanation with three concepts: - **TCP
handshake:** SYN, SYN-ACK, ACK establishes a connection. - **HTTP
request/response:** the client asks for an object; the server replies. -
**Connection reuse:** a persistent HTTP/1.1 connection can carry
multiple requests, avoiding repeated TCP setup.

Show one small sequence diagram for each mode. Put details behind
optional "Explain this" controls rather than making the page a textbook.

### Section F --- Evidence / methodology

**Purpose:** make the project credible for an academic evaluation.

A compact evidence panel explains: - Which values come from the
deterministic browser simulation. - Which values come from an optional
local Python server/capture run. - How TCP connections and handshakes
are counted. - What was held constant between modes. - The difference
between simulated latency and measured wall-clock latency.

Include a `Real capture` / `Browser simulation` status indicator only if
the two modes are genuinely implemented. Do not imply that the browser
itself can capture arbitrary host TCP packets.

### Section G --- Footer

Minimal footer: - `Computer Networks · Interactive Experiment` - Topic:
HTTP Keep-Alive vs New-Connection Requests - Small links to methodology,
repository, and report if they exist. - No fake institution, fake
authors, fake results, or placeholder social links presented as real.

------------------------------------------------------------------------

## 5. Simulation and experiment behaviour

### Recommended MVP: browser-based deterministic simulation

The website must be useful before any local capture tools are
configured. Implement a deterministic event model in
JavaScript/TypeScript that calculates expected events and animates them.

For a simple sequential model with `N` objects: - New-connection mode:
each object creates its own TCP connection and handshake. - Keep-Alive
mode: one TCP connection is established and reused for all `N`
objects. - Both modes fetch the same objects with the same payload sizes
and the same configured RTT. - Use the same request/response assumptions
in both modes. - Make assumptions visible in the methodology panel.

A simplified latency model can be used for teaching: - New connection:
approximately
`N × (TCP setup RTT + request/response RTT) + payload transfer time` -
Keep-Alive: approximately
`1 × TCP setup RTT + N × request/response RTT + payload transfer time`

For the MVP, define clearly what each RTT represents and avoid
double-counting. This is an educational model, not a universal
prediction for every browser/network. Actual HTTP timing depends on
factors such as TLS, server processing, bandwidth, object size,
concurrency, caching, TCP slow start, and implementation details.

Suggested event structure:

``` ts
type NetworkEvent = {
  id: string;
  timeMs: number;
  connectionId: number;
  direction: "client-to-server" | "server-to-client";
  type: "SYN" | "SYN_ACK" | "ACK" | "HTTP_REQUEST" |
        "HTTP_RESPONSE" | "FIN" | "CONNECTION_REUSE";
  label: string;
  objectIndex?: number;
};
```

Generate events from a single model function so the animation, event
log, counters, and charts all use the same source of truth. Do not
separately hard-code animation events and metric totals.

### Optional real measurement mode

If a genuine capture is needed for evaluation, use a local Python
HTTP/1.1 server/client and Wireshark/tshark or dumpcap as an optional
companion workflow. The React site can display imported results or call
a local API only if that integration is deliberately built and
documented.

Important technical boundary: - A normal browser webpage cannot silently
start Wireshark or capture arbitrary system TCP traffic. - A React-only
simulation is not a real packet capture. - If live capture is
implemented, label it accurately and document dependencies, permissions,
platform limitations, and the start/stop workflow. - Do not make the
whole project dependent on Npcap/Wireshark just to demonstrate the core
idea.

### Counters and validation

For a sequential comparison with no retries: - New connections opened =
`N`. - New TCP handshakes = `N`. - Keep-Alive connections opened = `1`
for `N > 0`, otherwise `0`. - Keep-Alive TCP handshakes = `1` for
`N > 0`, otherwise `0`. - HTTP requests completed = `N` for both modes
after a successful run. - A zero-object run should not claim a
connection or handshake occurred.

The event log, connection count, handshake count, and chart must agree.
If optional parallelism is added, define the expected connection
strategy explicitly before using it in the results.

------------------------------------------------------------------------

## 6. Recommended React stack

Keep the stack modern but small. Avoid introducing a heavy 3D engine
unless the 2D/SVG implementation demonstrably cannot achieve the desired
result.

-   **React + TypeScript + Vite** --- quick development, typed state,
    simple local setup.
-   **Tailwind CSS** --- consistent styling and responsive layout;
    custom CSS for signature G-frame and vector details.
-   **Motion for React** (`motion`) --- scroll-linked zoom, entrance
    transitions, and UI feedback. Its React APIs support both
    scroll-triggered and scroll-linked animation. Documentation:
    https://motion.dev/docs/react-scroll-animations
-   **SVG** --- primary packet paths, nodes, arrows, and sequence
    diagrams.
-   **Recharts** or a small custom SVG chart --- use one, not both. A
    custom SVG chart is enough for the MVP.
-   **Lucide React** --- small interface icons only.
-   **Vitest** --- unit tests for event generation and metric
    calculations.
-   **ESLint** --- code consistency.

### Avoid in the first version

-   Three.js / WebGL / large 3D environments.
-   Redux or another global state manager.
-   A database, authentication, or user profiles.
-   Multiple routes/pages.
-   A complex backend for values the browser can simulate
    deterministically.
-   A large UI component library that makes the visual system generic.

### Suggested project structure

``` text
src/
  app/
    App.tsx
  components/
    layout/
      Navbar.tsx
      SectionFrame.tsx
      CyberCard.tsx
    network/
      NetworkStage.tsx
      ClientNode.tsx
      ServerNode.tsx
      PacketPath.tsx
      Packet.tsx
      EventLog.tsx
    experiment/
      ExperimentControls.tsx
      MetricCard.tsx
      ComparisonChart.tsx
      ResultSummary.tsx
    education/
      ModeComparison.tsx
      SequenceDiagram.tsx
      MethodologyPanel.tsx
  hooks/
    useExperiment.ts
    useReducedMotion.ts
  lib/
    simulation.ts
    metrics.ts
    format.ts
  types/
    experiment.ts
  styles/
    index.css
    tokens.css
  main.tsx
```

Keep components small and focused. The simulation engine must not live
inside a giant `App.tsx` component.

------------------------------------------------------------------------

## 7. Interaction and visual details

### Navbar

-   Minimal wordmark: `REUSE / RECONNECT`
-   Small links: `Experiment`, `How it works`, `Method`
-   A compact progress indicator can follow page scroll.
-   On mobile, collapse links cleanly.

### Cyber vector card behaviour

-   Thin border brightens on hover/focus.
-   Small node or signal detail animates on hover.
-   Card title and explanation remain stable; avoid excessive tilt and
    flashing.
-   Keyboard focus must be obvious.

### G-frame behaviour

-   Build with CSS pseudo-elements or SVG paths.
-   Hero frame slowly tightens/zooms into the network diagram as the
    user scrolls.
-   Reuse the frame as a motif around the experiment stage, but vary its
    size and placement.
-   Avoid clipping controls, labels, or text at smaller breakpoints.

### Zoom scrolling

-   Use a normal scroll page with scroll-linked transforms for the
    hero-to-lab transition.
-   Keep text readable while the vector scene scales.
-   Use a subtle scale range rather than a disorienting full-screen
    zoom.
-   Do not animate every section in the same way; one or two signature
    transitions are enough.
-   Disable or simplify zoom/parallax for
    `prefers-reduced-motion: reduce`.

### Sound

No sound is required for the MVP. If added later, it must be off by
default and user-controlled.

------------------------------------------------------------------------

## 8. Responsive and accessibility requirements

-   Desktop: wide network stage, controls/results arranged in a balanced
    grid.
-   Tablet: reduce spacing and place controls above or below the network
    scene.
-   Mobile: stack cards, keep the network diagram readable, and allow
    the event log to scroll independently.
-   All controls must have labels and keyboard operation.
-   Never use colour alone to distinguish connection states; also use
    labels, shapes, or line patterns.
-   Ensure adequate contrast and visible focus states.
-   Provide a reduced-motion mode.
-   Do not autoplay a long simulation on page load.
-   Make the experiment understandable without audio.
-   Avoid tiny technical labels that look good only in a desktop
    screenshot.

------------------------------------------------------------------------

## 9. Build plan for the coding agent

### Phase 1 --- Foundation

1.  Create a fresh Vite React TypeScript project.
2.  Set up Tailwind and the global design tokens.
3.  Build the page shell, navbar, section anchors, typography, and
    responsive spacing.
4.  Implement the G-frame and cyber vector card primitives.
5.  Confirm the page looks polished before adding complex animation.

### Phase 2 --- Network visualization

1.  Build client, network, and server nodes in SVG.
2.  Draw separate paths for connection setup, HTTP requests/responses,
    and connection close.
3.  Create packet markers and event labels.
4.  Ensure the diagram scales on mobile.

### Phase 3 --- Simulation engine

1.  Define typed experiment settings and events.
2.  Implement deterministic event generation for both modes.
3.  Derive counts, duration, and comparison metrics from the generated
    events/model.
4.  Add tests for zero objects, one object, multiple objects, and
    expected connection/handshake counts.
5.  Ensure both modes use identical request and payload assumptions.

### Phase 4 --- Playback and controls

1.  Connect controls to the simulation state.
2.  Add run, pause, replay, and reset.
3.  Synchronize packet animation, counters, and event log.
4.  Prevent overlapping runs and stale timers.
5.  Add clear empty, running, completed, and error states.

### Phase 5 --- Results and explanation

1.  Add comparison cards and a simple chart.
2.  Generate a result summary from the active settings.
3.  Add concise handshake and Keep-Alive explanations.
4.  Add a methodology panel distinguishing model output from real
    measurements.

### Phase 6 --- Scroll motion and polish

1.  Add restrained scroll-linked hero zoom.
2.  Add section reveal transitions and subtle card hover states.
3.  Add reduced-motion fallbacks.
4.  Test on mobile, tablet, and desktop.
5.  Check performance and remove unnecessary animation or dependencies.

### Phase 7 --- Academic validation

1.  Verify all displayed counts against generated events.
2.  Confirm the connection and handshake logic is correct for the chosen
    model.
3.  Run automated tests.
4.  If using a real capture, compare packet evidence with the model and
    document discrepancies.
5.  Make sure screenshots, report numbers, and website labels agree.

------------------------------------------------------------------------

## 10. Definition of done

The first release is complete when:

-   [ ] It is a single-page React + TypeScript website.
-   [ ] The design clearly includes cyber vector cards, a G-shaped frame
    motif, and restrained zoom scrolling.
-   [ ] Users can choose object count and RTT.
-   [ ] Users can run and compare both connection strategies.
-   [ ] Packets/events animate in the correct order.
-   [ ] Connection count, handshake count, request count, and timing are
    shown.
-   [ ] Results are generated from the model rather than hard-coded.
-   [ ] The website distinguishes simulated results from real capture
    evidence.
-   [ ] The methodology and assumptions are easy to find.
-   [ ] The interface works on mobile and desktop.
-   [ ] Reduced-motion and keyboard accessibility are supported.
-   [ ] No fake measured results, placeholder citations, or
    nonfunctional controls remain.
-   [ ] Setup instructions are short and reproducible.

------------------------------------------------------------------------

## 11. Final instruction for the coding agent

Treat this file as the product and design specification. Start from a
clean React project. Do not port the old page structure, Python package
layout, article chapters, 3D lab, or existing dashboard. Reuse only the
underlying experiment idea: compare HTTP requests made using new TCP
connections with requests made over a persistent connection.

Prioritize the working experiment and its evidence first, then apply the
visual system. The final result should feel like a small, premium,
interactive networking exhibit --- not a research paper, not a generic
admin dashboard, and not a 3D game that hides the actual experiment.
