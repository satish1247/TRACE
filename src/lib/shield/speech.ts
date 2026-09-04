/**
 * Thin wrapper around `window.SpeechRecognition` / `window.webkitSpeechRecognition`
 * for live transcription, plus a typed-input fallback that produces the
 * exact same `TranscriptLine` shape — `markers.ts`/`taxonomy.ts`/`interview.ts`
 * only ever see transcript lines, never where they came from.
 *
 * PRD-1-SHIELD.md traps: Web Speech needs Chrome + a secure origin
 * (`localhost` works, a bare LAN IP does not); never run two microphone
 * consumers at once. This module enforces the second by construction — the
 * `active` guard below makes `start()` a no-op while a recognition session
 * is already running, so it can never be double-started.
 */
import type { Speaker, TranscriptLine } from "./types";

export type SpeechStatus = "idle" | "listening" | "unsupported" | "denied" | "error";

/** Minimal shape of the (non-standardized) Web Speech Recognition API —
 * declared locally rather than assumed from `lib.dom.d.ts`, which does not
 * reliably include it across TypeScript/lib versions. */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResultLike {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechWindow {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as unknown as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

/** True when the browser exposes a Web Speech recognition constructor. Does
 * not indicate microphone permission — that is only known after `start()`. */
export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

/** Build a `TranscriptLine` from typed text — the always-present fallback
 * path (S1). Produces the identical shape recognized speech produces. */
export function createTypedLine(text: string, speaker: Speaker): TranscriptLine {
  return { speaker, text: text.trim(), at: Date.now() };
}

export interface SpeechControllerOptions {
  /** Speaker attributed to lines recognized from the microphone. The UI
   * decides this (typically "caller", since the phone is on speaker and
   * the mic mostly picks up the other side of the call). */
  speaker: Speaker;
  onLine: (line: TranscriptLine) => void;
  onStatusChange: (status: SpeechStatus) => void;
}

export interface SpeechController {
  start: () => void;
  stop: () => void;
  isActive: () => boolean;
}

function isPermissionError(errorCode: string): boolean {
  return errorCode === "not-allowed" || errorCode === "service-not-allowed";
}

/**
 * Create a controller wrapping one Web Speech recognition session. Safe to
 * call `start()` repeatedly — it is a no-op while a session is already
 * active, guaranteeing at most one microphone consumer at a time (C2).
 */
export function createSpeechController(options: SpeechControllerOptions): SpeechController {
  let recognition: SpeechRecognitionLike | null = null;
  let active = false;
  let stoppedByCaller = false;

  function attachHandlers(instance: SpeechRecognitionLike): void {
    instance.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result.isFinal) continue;
        const alternative = result[0];
        const text = alternative?.transcript.trim() ?? "";
        if (text.length === 0) continue;
        options.onLine({ speaker: options.speaker, text, at: Date.now() });
      }
    };

    instance.onerror = (event) => {
      active = false;
      options.onStatusChange(isPermissionError(event.error) ? "denied" : "error");
    };

    instance.onend = () => {
      active = false;
      if (stoppedByCaller) {
        options.onStatusChange("idle");
        return;
      }
      // The browser ended the session on its own (common after a silence
      // timeout). Restart to keep listening through the rest of the call —
      // `active` is already false here, so this cannot race a manual start().
      start();
    };
  }

  function start(): void {
    if (active) return;

    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) {
      options.onStatusChange("unsupported");
      return;
    }

    stoppedByCaller = false;
    const instance = new Ctor();
    instance.lang = "en-US";
    instance.continuous = true;
    instance.interimResults = false;
    attachHandlers(instance);
    recognition = instance;

    try {
      instance.start();
      active = true;
      options.onStatusChange("listening");
    } catch {
      active = false;
      options.onStatusChange("error");
    }
  }

  function stop(): void {
    stoppedByCaller = true;
    if (recognition && active) {
      recognition.stop();
    }
    active = false;
  }

  return {
    start,
    stop,
    isActive: () => active,
  };
}
