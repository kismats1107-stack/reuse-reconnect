import { ArrowRight, Hand, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Experiment } from "../../hooks/useExperiment";
import { useSpeech } from "../../hooks/useSpeech";
import { metricsAt } from "../../lib/metrics";
import { narrate, tourSteps } from "../../lib/narration";
import { finding } from "../../lib/summary";
import type { NetworkEvent, Strategy } from "../../types/experiment";
import { CyberCard } from "../layout/CyberCard";
import { KIND_CSS, packetKind } from "../scene/layout";
import { Legend } from "./Legend";

type Lesson =
  | { kind: "intro"; title: string }
  | { kind: "walk"; strategy: Strategy; objects: number; title: string; intro: string }
  | { kind: "race"; objects: number; title: string }
  | { kind: "end"; title: string };

const RTT = 50;
const LESSONS: Lesson[] = [
  { kind: "intro", title: "Welcome to the network lab" },
  {
    kind: "walk",
    strategy: "close",
    objects: 2,
    title: "The old way: a new connection for every file",
    intro: "Let's load a tiny web page with 2 files. Here, the browser opens a brand-new connection for each file. Press the button to send one packet at a time.",
  },
  {
    kind: "walk",
    strategy: "keepalive",
    objects: 2,
    title: "The smart way: Keep-Alive",
    intro: "Same 2 files, same server. This time the connection is kept open and reused. Watch what happens before the second file.",
  },
  { kind: "race", objects: 10, title: "Race! 10 files, both ways at once" },
  { kind: "end", title: "Your turn!" },
];

// What the narrator says. Kept next to the lessons so the spoken and written words match.
const SAY = {
  intro:
    "Welcome to the network lab. A web page is not one file. It is many files: the HTML, the styles, pictures and fonts. Your browser, on the left, must fetch every file from the web server, on the right. Before it can ask for anything, it has to open a TCP connection with a three-step handshake. So, should the browser open a new connection for every file, or keep one connection open and reuse it? Let's find out.",
  raceIntro:
    "Now a real page with 10 files. Lane A opens a new connection for every file. Lane B uses Keep-Alive. Watch the handshakes and the time counters at the top.",
  end: "You've seen it. Every new connection costs a handshake, and every handshake costs a trip to the server and back. Keep-Alive pays it only once. Now it's your turn: change the number of files and how far away the server is, then race again, and try to finish all the challenges.",
};

function outro(strategy: Strategy, objects: number, connections: number, handshakes: number): string {
  const head = `${objects} files: ${connections} connection${connections === 1 ? "" : "s"} and ${handshakes} handshake${handshakes === 1 ? "" : "s"}.`;
  return strategy === "close"
    ? `${head} Every file paid for its own handshake, and every connection was thrown away. Look at the pile next to the browser!`
    : `${head} The second file skipped the handshake and went out straight away. That is the whole idea of Keep-Alive.`;
}

const stepWords = (events: NetworkEvent[]) =>
  events
    .map((e) => {
      const l = narrate(e);
      return `${l.who}: ${l.say} ${l.teach}`;
    })
    .join(" ");

const VOICE_KEY = "reuse-reconnect:voice";
function voicePref(): boolean {
  try {
    return localStorage.getItem(VOICE_KEY) !== "off";
  } catch {
    return true;
  }
}

/**
 * The guided first visit. It drives the real experiment: each lesson sets up a
 * run, and "Next" plays it one packet group at a time with a plain-language
 * explanation, read aloud when the voice is on. Hands-free mode presses "Next"
 * by itself once the narrator has finished and the packets have landed, so the
 * tour can present itself.
 */
export function Tour({ x, onExit }: { x: Experiment; onExit: () => void }) {
  const [li, setLi] = useState(0);
  const [sub, setSub] = useState(-1);
  const [nonce, setNonce] = useState(0); // bumps to restart the current lesson
  const [voiceOn, setVoiceOn] = useState(voicePref);
  const [handsFree, setHandsFree] = useState(false);
  const [heardKey, setHeardKey] = useState<string | null>(null);
  const voice = useSpeech();
  const lesson = LESSONS[li];
  const xr = useRef(x);
  useEffect(() => {
    xr.current = x;
  });

  // Set up the run that belongs to each lesson.
  useEffect(() => {
    const ex = xr.current;
    if (lesson.kind === "walk") ex.start({ objects: lesson.objects, rttMs: RTT, mode: lesson.strategy }, { paused: true });
    else if (lesson.kind === "race") ex.start({ objects: lesson.objects, rttMs: RTT, mode: "compare" }, { paused: true });
    else if (lesson.kind === "intro") ex.update({ objects: 2, rttMs: RTT, mode: "compare" });
  }, [lesson, nonce]);

  const run = lesson.kind === "walk" ? x.run?.[lesson.strategy] : undefined;
  const steps = useMemo(() => (run ? tourSteps(run) : []), [run]);
  const busy = x.status === "running";
  const finished = x.status === "done";

  // ---- the narrator: one spoken text per screen, keyed so it is said once ----
  let speech: { key: string; text: string };
  if (lesson.kind === "intro") speech = { key: `intro-${nonce}`, text: SAY.intro };
  else if (lesson.kind === "walk") {
    const s = sub >= 0 ? steps[sub] : null;
    const m = run ? metricsAt(run) : null;
    // The last packet group also says the lesson's conclusion, so nothing is cut off when it finishes.
    const last = s && sub === steps.length - 1 && m ? ` ${outro(lesson.strategy, lesson.objects, m.connections, m.handshakes)}` : "";
    speech = s ? { key: `walk-${li}-${sub}-${nonce}`, text: stepWords(s.events) + last } : { key: `walk-${li}-intro-${nonce}`, text: `${lesson.title}. ${lesson.intro.replace(" Press the button to send one packet at a time.", "")}` };
  } else if (lesson.kind === "race") {
    speech = finished ? { key: `race-done-${nonce}`, text: finding(x.run?.close, x.run?.keepalive) } : { key: `race-${nonce}`, text: SAY.raceIntro };
  } else speech = { key: `end-${nonce}`, text: SAY.end };

  // Say each new screen once. A screen change caused by the animation (a race
  // finishing) waits for the current sentence; a button press cuts it short.
  const queue = useRef(Promise.resolve());
  const latest = useRef(speech.key);
  useEffect(() => {
    const { key, text } = speech;
    latest.current = key;
    if (!voiceOn || !voice.supported) {
      // No voice: give people time to read before hands-free moves on.
      const words = text.split(/\s+/).length;
      const id = window.setTimeout(() => setHeardKey(key), Math.max(2500, words * 260));
      return () => window.clearTimeout(id);
    }
    queue.current = queue.current.then(() => (latest.current === key ? voice.speak(text).then(() => setHeardKey(key)) : undefined));
    // speech.text is derived from speech.key's inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.key, voiceOn]);

  const hearAgain = () => {
    voice.cancel();
    setHeardKey(null);
    queue.current = Promise.resolve();
    voice.speak(speech.text).then(() => setHeardKey(speech.key));
  };

  const go = (i: number) => {
    voice.cancel();
    setSub(-1);
    setLi(i);
    setNonce((n) => n + 1);
  };
  const nextPacket = () => {
    const s = steps[sub + 1];
    if (!s) return;
    voice.cancel();
    setSub(sub + 1);
    x.playTo(s.target);
  };

  let body: ReactNode;
  let action: { label: string; onClick: () => void; disabled?: boolean };

  if (lesson.kind === "intro") {
    body = (
      <div className="grid gap-2.5 text-[0.95rem] leading-relaxed text-muted">
        <p>
          A web page is not one file. It is <b className="text-text">many files</b>: the HTML, styles, pictures, fonts…
        </p>
        <p>
          Your <b className="text-cyan">browser</b> (left) must fetch every file from the <b className="text-lime">web server</b> (right). Before it can ask for anything, it has to open a{" "}
          <b className="text-text">TCP connection</b> with a 3-step <b className="text-cost">handshake</b>.
        </p>
        <p className="text-text">Should the browser open a new connection for every file, or keep one open and reuse it? Let's find out.</p>
        <Legend className="mt-1" />
        <p className="text-xs text-faint">Tip: drag to rotate the world, scroll to zoom. Press “Hands-free” and the tour will present itself.</p>
      </div>
    );
    action = { label: "Start lesson 1", onClick: () => go(1) };
  } else if (lesson.kind === "walk") {
    const s = sub >= 0 ? steps[sub] : null;
    const m = run && finished ? metricsAt(run) : null;
    body = (
      <div className="grid gap-3">
        {!s && <p className="text-[0.95rem] leading-relaxed text-muted">{lesson.intro}</p>}
        {s && (
          <div className="grid gap-2" aria-live="polite">
            {s.events.map((e, i) => {
              const line = narrate(e);
              const color = e.type === "CONNECTION_REUSE" ? KIND_CSS.response : KIND_CSS[packetKind(e)];
              return (
                <div key={e.id} className={i === 0 ? "" : "border-t border-line pt-2"}>
                  <p className="flex flex-wrap items-baseline gap-2">
                    <span className="tech" style={{ color, borderColor: color }}>
                      {line.tech}
                    </span>
                    <span className={`text-sm ${line.who === "Browser" ? "text-cyan" : "text-lime"}`}>{line.who}</span>
                    <span className={i === 0 ? "font-display text-lg text-text" : "text-text"}>“{line.say}”</span>
                  </p>
                  <p className={`mt-1 leading-relaxed text-muted ${i === 0 ? "text-[0.92rem]" : "text-sm"}`}>{line.teach}</p>
                </div>
              );
            })}
          </div>
        )}
        {m && <p className="border-l-2 border-lime pl-3 text-[0.95rem] leading-relaxed text-text">{outro(lesson.strategy, lesson.objects, m.connections, m.handshakes)}</p>}
      </div>
    );
    action = finished
      ? { label: "Next lesson", onClick: () => go(li + 1) }
      : { label: sub < 0 ? "Send the first packet" : busy ? "Watch…" : "Next packet", onClick: nextPacket, disabled: busy };
  } else if (lesson.kind === "race") {
    body = finished ? (
      <p className="border-l-2 border-lime pl-3 text-[0.95rem] leading-relaxed text-text">{finding(x.run?.close, x.run?.keepalive)}</p>
    ) : (
      <p className="text-[0.95rem] leading-relaxed text-muted">
        Now a real page with <b className="text-text">10 files</b>. Lane <b className="text-cost">A</b> opens a new connection for every file; lane <b className="text-lime">B</b> uses Keep-Alive. Watch the{" "}
        <b className="text-text">Handshakes</b> and <b className="text-text">Time</b> counters at the top.
      </p>
    );
    action = finished
      ? { label: "Next", onClick: () => go(li + 1) }
      : {
          label: busy ? "Racing…" : "Start the race",
          onClick: () => {
            if (x.run) x.playTo(x.run.endMs);
          },
          disabled: busy,
        };
  } else {
    body = (
      <div className="grid gap-2 text-[0.95rem] leading-relaxed text-muted">
        <p>
          You've seen it: <b className="text-text">every new connection costs a handshake</b>, and every handshake costs a trip to the server and back. Keep-Alive pays it only once.
        </p>
        <p>
          Now experiment yourself. Change the <b className="text-text">number of files</b> and <b className="text-text">how far away the server is</b>, then race again. Can you finish all the{" "}
          <b className="text-lime">challenges</b>?
        </p>
      </div>
    );
    action = { label: "Start exploring", onClick: onExit };
  }

  // Hands-free: once this screen has been said and nothing is moving, press the button.
  const actionRef = useRef(action);
  useEffect(() => {
    actionRef.current = action;
  });
  const isEnd = lesson.kind === "end";
  useEffect(() => {
    if (!handsFree || isEnd || busy || heardKey !== speech.key) return;
    const id = window.setTimeout(() => {
      const a = actionRef.current;
      if (!a.disabled) a.onClick();
    }, 900);
    return () => window.clearTimeout(id);
  }, [handsFree, isEnd, busy, heardKey, speech.key]);

  const toggleVoice = () => {
    const on = !voiceOn;
    setVoiceOn(on);
    try {
      localStorage.setItem(VOICE_KEY, on ? "on" : "off");
    } catch {
      /* preference not saved */
    }
    if (on) {
      voice.speak(speech.text).then(() => setHeardKey(speech.key));
    } else voice.cancel();
  };

  return (
    <CyberCard tone="lime" className="pointer-events-auto max-h-[52dvh] w-full max-w-2xl overflow-y-auto p-4 backdrop-blur-md sm:max-h-none sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="eyebrow text-[0.66rem]! text-lime!">
          Guided tour · {li + 1}/{LESSONS.length}
        </p>
        <div className="flex gap-1" aria-hidden="true">
          {LESSONS.map((_, i) => (
            <span key={i} className={`h-1 w-5 ${i <= li ? "bg-lime" : "bg-line-strong"}`} />
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {voice.supported && (
            <button
              type="button"
              onClick={toggleVoice}
              aria-pressed={voiceOn}
              title={voiceOn ? `Voice on${voice.voiceName ? ` (${voice.voiceName})` : ""}: click to mute` : "Voice off: click to hear the narrator"}
              className={`flex items-center gap-1.5 border px-2 py-1 font-mono text-xs ${voiceOn ? "border-lime/60 text-lime" : "border-line-strong text-muted hover:text-text"}`}
            >
              {voiceOn ? <Volume2 size={14} aria-hidden="true" /> : <VolumeX size={14} aria-hidden="true" />}
              {voiceOn ? "Voice" : "Muted"}
              {voiceOn && voice.speaking && <SpeakingBars />}
            </button>
          )}
          <button
            type="button"
            onClick={() => setHandsFree((v) => !v)}
            aria-pressed={handsFree}
            title="Hands-free: the tour moves on by itself"
            className={`flex items-center gap-1.5 border px-2 py-1 font-mono text-xs ${handsFree ? "border-cyan bg-cyan text-ink" : "border-line-strong text-muted hover:text-text"}`}
          >
            <Hand size={14} aria-hidden="true" /> Hands-free
          </button>
          <button type="button" onClick={onExit} className="ml-1 flex items-center gap-1 font-mono text-xs text-muted hover:text-text">
            Skip <X size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
      <h2 className="mb-2 text-lg font-semibold leading-tight sm:mb-3 sm:text-2xl">{lesson.title}</h2>
      {body}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={action.onClick} disabled={action.disabled}>
          {action.label} <ArrowRight size={16} aria-hidden="true" />
        </button>
        {voiceOn && voice.supported && (
          <button type="button" className="btn btn-ghost" onClick={hearAgain} title="Read this step aloud again">
            <Volume2 size={16} aria-hidden="true" /> {heardKey === speech.key || voice.speaking ? "Hear again" : "Listen"}
          </button>
        )}
        {li > 0 && (
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => go(li)} aria-label="Restart this lesson" title="Restart this lesson">
            <RotateCcw size={16} />
          </button>
        )}
        {lesson.kind === "walk" && sub >= 0 && !finished && (
          <span className="ml-auto font-mono text-xs text-faint">
            packet group {sub + 1}/{steps.length}
          </span>
        )}
      </div>
    </CyberCard>
  );
}

/** Three little bars that bounce while the narrator talks. */
function SpeakingBars() {
  return (
    <span aria-hidden="true" className="speaking-bars">
      <i />
      <i />
      <i />
    </span>
  );
}
