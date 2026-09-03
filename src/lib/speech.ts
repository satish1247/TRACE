"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Minimal typing for the Web Speech API (Chrome). Absent => the UI shows the typed fallback only. */
interface SRResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}
interface SR {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SRResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SRCtor = new () => SR;

function getCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeech(onFinal: (text: string) => void, opts: { continuous?: boolean; lang?: string } = {}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const rec = useRef<SR | null>(null);
  const cb = useRef(onFinal);
  cb.current = onFinal;

  useEffect(() => {
    setSupported(getCtor() !== null);
  }, []);

  const stop = useCallback(() => {
    rec.current?.stop();
    rec.current = null;
    setListening(false);
    setInterim("");
  }, []);

  const start = useCallback(() => {
    const C = getCtor();
    if (!C) return;
    const r = new C();
    r.lang = opts.lang ?? "en-IN";
    r.continuous = opts.continuous ?? false;
    r.interimResults = true;
    r.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const t = res[0]?.transcript ?? "";
        if (res.isFinal) finalText += t;
        else interimText += t;
      }
      setInterim(interimText);
      if (finalText.trim()) cb.current(finalText.trim());
    };
    r.onend = () => {
      setListening(false);
      rec.current = null;
    };
    r.onerror = () => {
      setListening(false);
      rec.current = null;
    };
    rec.current = r;
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  }, [opts.continuous, opts.lang]);

  useEffect(() => () => rec.current?.stop(), []);

  return { supported, listening, interim, start, stop };
}
