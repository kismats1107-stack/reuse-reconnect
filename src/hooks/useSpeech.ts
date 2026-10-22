import { useCallback, useEffect, useRef, useState } from "react";

/** How network words should sound when read aloud (TTS engines guess badly). */
const SAY_AS: [RegExp, string][] = [
  [/SYN-ACK/g, "sin-ack"],
  [/\bSYN\b/g, "sin"],
  [/\bACK\b/g, "ack"],
  [/FIN\+ACK/g, "fin, ack"],
  [/\bFIN\b/g, "fin"],
  [/\bRTT\b/g, "R T T"],
  [/\bTCP\b/g, "T C P"],
  [/\bHTTP\b/g, "H T T P"],
  [/\bGET\b/g, "get"],
  [/\b200 OK\b/g, "two hundred, OK"],
  [/(\d+(?:\.\d+)?) ms\b/g, "$1 milliseconds"],
  [/(\d+) KB\b/g, "$1 kilobytes"],
  [/“|”/g, ""],
];

export function speakable(text: string): string {
  return SAY_AS.reduce((t, [re, to]) => t.replace(re, to), text);
}

/** Prefer a natural Indian-English voice, then any natural English voice, then any English voice. */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const rank = (v: SpeechSynthesisVoice) =>
    (v.lang.toLowerCase() === "en-in" ? 4 : 0) + (/natural|online|neural/i.test(v.name) ? 2 : 0) + (/google/i.test(v.name) ? 1 : 0);
  return en.sort((a, b) => rank(b) - rank(a))[0] ?? null;
}

/**
 * Read-aloud with the browser's built-in speech (no audio files, works offline
 * with the OS voices). Text is queued sentence by sentence because Chrome
 * cuts long utterances off. Browsers only allow speech after the visitor has
 * clicked something on the page.
 */
export function useSpeech() {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [speaking, setSpeaking] = useState(false);
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const voice = useRef<SpeechSynthesisVoice | null>(null);
  const run = useRef(0); // bumps on every new speak/cancel so stale callbacks are ignored
  const finish = useRef<(() => void) | null>(null); // resolves the speech in progress

  useEffect(() => {
    if (!supported) return;
    const load = () => {
      voice.current = pickVoice(window.speechSynthesis.getVoices());
      setVoiceName(voice.current?.name ?? null);
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  const cancel = useCallback(() => {
    if (!supported) return;
    run.current++;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    finish.current?.();
    finish.current = null;
  }, [supported]);

  /** Speaks `text`; resolves when it has finished (or was cut off). */
  const speak = useCallback(
    (text: string) =>
      new Promise<void>((resolve) => {
        if (!supported || !text.trim()) return resolve();
        finish.current?.(); // whoever waited on the previous speech may go on
        const id = ++run.current;
        finish.current = resolve;
        window.speechSynthesis.cancel();
        const parts = speakable(text)
          .split(/(?<=[.!?])\s+/)
          .map((s) => s.trim())
          .filter(Boolean);
        setSpeaking(true);
        parts.forEach((part, i) => {
          const u = new SpeechSynthesisUtterance(part);
          if (voice.current) u.voice = voice.current;
          u.lang = voice.current?.lang ?? "en-IN";
          u.rate = 0.98;
          const last = i === parts.length - 1;
          const done = () => {
            if (run.current !== id) return;
            setSpeaking(false);
            finish.current = null;
            resolve();
          };
          u.onend = () => {
            if (last) done();
          };
          // "not-allowed" before the first click, "interrupted" on cancel: treat as finished
          u.onerror = done;
          window.speechSynthesis.speak(u);
        });
      }),
    [supported],
  );

  return { supported, speaking, speak, cancel, voiceName };
}
