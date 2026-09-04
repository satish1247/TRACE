"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyseAudio, type ForensicsResult } from "@/lib/audioForensics";
import { detectMarkers, kindsPresent, MARKER_LABEL, riskFromMarkers } from "@/lib/screening";
import { classifyNarrative } from "@/lib/taxonomy";
import { currentBalance, FLOOR, propagateTaint } from "@/lib/taint";
import { AGENT_TRIPS, AGENT_LIMIT } from "@/lib/agent";
import type { Classification, MarkerKind, TraceNode } from "@/lib/types";

interface DeepVerdict {
  isScam: boolean;
  scamType: string;
  confidence: number;
  reasoning: string;
  advice: string;
}

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const ORDER: MarkerKind[] = ["authority", "threat", "isolation", "demand", "blocking"];

/** The page is dark but <body> is not, so over-scroll shows a light band. Paint the document too. */
function useDarkDocument() {
  useEffect(() => {
    const prev = document.documentElement.style.background;
    document.documentElement.style.background = "#0C1316";
    document.body.style.background = "#0C1316";
    return () => {
      document.documentElement.style.background = prev;
      document.body.style.background = "";
    };
  }, []);
}

export default function Lab() {
  useDarkDocument();
  return (
    <main className="stage-dark min-h-screen" style={{ background: "var(--ground)", color: "var(--ink)" }}>
      <header className="flex flex-wrap items-center justify-between gap-4 px-8 py-5" style={{ borderBottom: "1px solid var(--hairline)" }}>
        <div className="flex items-baseline gap-4">
          <span className="text-2xl font-bold tracking-tight">
            TR<span style={{ color: "var(--accent)" }}>A</span>CE
          </span>
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            Investigation console
          </span>
        </div>
        <Link href="/" className="mono text-xs underline" style={{ color: "var(--muted)" }}>
          live call screen
        </Link>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 p-8">
        <Panel1 />
        <Panel2 />
        <Panel3 />
        <Panel4 />
      </div>
    </main>
  );
}

function Card({ n, title, subtitle, children }: { n: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg p-6" style={{ background: "var(--surface)" }}>
      <div className="mb-4 flex items-baseline gap-3">
        <span className="mono text-xs" style={{ color: "var(--accent)" }}>
          {n}
        </span>
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      {subtitle && (
        <p className="mb-4 text-sm" style={{ color: "var(--muted)" }}>
          {subtitle}
        </p>
      )}
      {children}
    </section>
  );
}

function Btn({ children, onClick, kind = "quiet", disabled }: { children: React.ReactNode; onClick?: () => void; kind?: "primary" | "quiet" | "danger"; disabled?: boolean }) {
  const s: Record<string, React.CSSProperties> = {
    primary: { background: "var(--accent)", color: "#0c1316" },
    quiet: { background: "var(--surface-2)", color: "var(--ink)" },
    danger: { background: "var(--critical)", color: "#fff" },
  };
  return (
    <button onClick={onClick} disabled={disabled} className="rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-40" style={s[kind]}>
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ 1. transcribe and analyse

interface SRLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: unknown) => void) | null;
  onend: (() => void) | null;
}

function Panel1() {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [result, setResult] = useState<{ risk: number; markers: MarkerKind[]; c: Classification } | null>(null);
  const [sent, setSent] = useState("");
  const [deep, setDeep] = useState<{ state: "idle" | "running" | "done" | "failed"; msg: string; v?: DeepVerdict; secs?: number }>({ state: "idle", msg: "" });
  const recRef = useRef<SRLike | null>(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const toggle = useCallback(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SRLike; webkitSpeechRecognition?: new () => SRLike };
    const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!C) return;
    if (listening) {
      const r = recRef.current;
      recRef.current = null;
      try {
        r?.stop();
      } catch {
        /* already stopped */
      }
      setListening(false);
      setInterim("");
      return;
    }
    const r = new C();
    r.lang = "en-IN";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e: unknown) => {
      const ev = e as { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> };
      let fin = "";
      let itm = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const seg = ev.results[i];
        if (seg.isFinal) fin += seg[0].transcript;
        else itm += seg[0].transcript;
      }
      setInterim(itm);
      if (fin.trim()) setText((p) => (p ? p + "\n" + fin.trim() : fin.trim()));
    };
    r.onend = () => {
      if (recRef.current) {
        try {
          r.start(); // keep going for the whole conversation
        } catch {
          setListening(false);
        }
      }
    };
    recRef.current = r;
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  }, [listening]);

  const analyse = () => {
    const lines = text.split("\n").filter((l) => l.trim());
    const hits = lines.flatMap((l, i) => detectMarkers(l, i));
    setResult({ risk: riskFromMarkers(hits), markers: kindsPresent(hits), c: classifyNarrative(text) });
  };

  /** Runs in the background: the model takes minutes, so the instant verdict stays on screen. */
  const runDeep = async () => {
    const t0 = Date.now();
    setDeep({ state: "running", msg: "Asking DeepSeek. This model takes two to four minutes on this network, so the instant verdict above stays put." });
    const tick = setInterval(() => {
      setDeep((d) => (d.state === "running" ? { ...d, secs: Math.round((Date.now() - t0) / 1000) } : d));
    }, 1000);
    try {
      const r = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      const j = (await r.json()) as { ok: boolean; verdict?: DeepVerdict; error?: string; ms?: number };
      clearInterval(tick);
      if (j.ok && j.verdict) setDeep({ state: "done", msg: "", v: j.verdict, secs: Math.round((j.ms ?? 0) / 1000) });
      else setDeep({ state: "failed", msg: j.error ?? "The model did not answer", secs: Math.round((Date.now() - t0) / 1000) });
    } catch {
      clearInterval(tick);
      setDeep({ state: "failed", msg: "Could not reach the server", secs: Math.round((Date.now() - t0) / 1000) });
    }
  };

  const sendToStage = async () => {
    setSent("sending...");
    const lines = text.split("\n").filter((l) => l.trim());
    try {
      await fetch("/api/phone", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "start", caller: "Investigation console" }) });
      for (const l of lines) {
        await fetch("/api/phone", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "line", text: l }) });
        await new Promise((r) => setTimeout(r, 250));
      }
      setSent("sent to the live screen");
    } catch {
      setSent("could not reach the server");
    }
  };

  return (
    <Card n="01" title="Transcribe and analyse" subtitle="Speak into the laptop, or paste a transcript. Then have the AI read it.">
      <div className="flex flex-wrap gap-2">
        <Btn kind={listening ? "danger" : "primary"} onClick={toggle} disabled={!supported}>
          {listening ? "Stop listening" : supported ? "Start speaking" : "Speech needs Chrome"}
        </Btn>
        <Btn onClick={analyse} disabled={!text.trim()}>
          Analyse with AI
        </Btn>
        <Btn onClick={runDeep} disabled={!text.trim() || deep.state === "running"}>
          {deep.state === "running" ? "Deep model thinking..." : "Second opinion (DeepSeek)"}
        </Btn>
        <Btn onClick={sendToStage} disabled={!text.trim()}>
          Send to the live screen
        </Btn>
        <Btn
          onClick={() => {
            setText("");
            setResult(null);
            setSent("");
          }}
        >
          Clear
        </Btn>
      </div>
      {interim && (
        <p className="mt-3 text-sm italic" style={{ color: "var(--accent)" }}>
          {interim}
        </p>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="Words appear here as you speak. You can also paste or correct the text."
        className="mt-3 w-full rounded-md p-3"
        style={{ background: "var(--surface-2)", color: "var(--ink)" }}
      />
      {sent && (
        <p className="mono mt-2 text-xs" style={{ color: "var(--safe)" }}>
          {sent}
        </p>
      )}
      {result && <Verdict risk={result.risk} markers={result.markers} c={result.c} />}

      {deep.state !== "idle" && (
        <div className="mt-4 rounded-md p-4" style={{ background: "var(--surface-2)" }}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="mono text-[11px] uppercase tracking-wider" style={{ color: "var(--accent)" }}>
              Second opinion · DeepSeek v4 Pro via NVIDIA
            </p>
            {deep.secs !== undefined && (
              <span className="mono text-xs" style={{ color: "var(--muted)" }}>
                {deep.secs}s
              </span>
            )}
          </div>
          {deep.state === "running" && (
            <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
              {deep.msg}
            </p>
          )}
          {deep.state === "failed" && (
            <p className="mt-2 text-sm" style={{ color: "var(--critical)" }}>
              {deep.msg}
            </p>
          )}
          {deep.state === "done" && deep.v && (
            <>
              <p className="mt-1 text-2xl font-bold" style={{ color: deep.v.isScam ? "var(--critical)" : "var(--safe)" }}>
                {deep.v.isScam ? `Scam · ${deep.v.scamType}` : "Not a scam"}
                <span className="mono ml-2 text-sm" style={{ color: "var(--muted)" }}>
                  {Math.round(deep.v.confidence * 100)}% confident
                </span>
              </p>
              <p className="mt-2 text-sm">{deep.v.reasoning}</p>
              {deep.v.advice && (
                <p className="mt-2 text-sm" style={{ color: "var(--accent)" }}>
                  {deep.v.advice}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function Verdict({ risk, markers, c }: { risk: number; markers: MarkerKind[]; c: Classification }) {
  const danger = risk >= 45;
  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <div>
        <div className="flex items-baseline justify-between">
          <span className="mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Risk
          </span>
          <span className="mono text-4xl font-bold" style={{ color: danger ? "var(--critical)" : "var(--safe)" }}>
            {risk}
          </span>
        </div>
        <ul className="mt-2 grid gap-px" style={{ background: "var(--hairline)" }}>
          {ORDER.map((k) => {
            const on = markers.includes(k);
            return (
              <li key={k} className="px-3 py-2 text-sm" style={{ background: on ? "var(--crit-tint)" : "var(--surface-2)", color: on ? "var(--critical)" : "var(--muted)" }}>
                {MARKER_LABEL[k]}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="rounded-md p-4" style={{ background: danger ? "var(--crit-tint)" : "var(--safe-tint)" }}>
        <p className="mono text-[11px] uppercase tracking-wider" style={{ color: danger ? "var(--critical)" : "var(--safe)" }}>
          {danger ? `Fraud · ${Math.round(c.confidence * 100)}% match` : "No scam pattern found"}
        </p>
        <p className="mt-1 text-2xl font-bold">{danger ? c.label : "Looks like an ordinary conversation"}</p>
        {danger && (
          <>
            <p className="mt-2">{c.rebuttal}</p>
            <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
              {c.stat}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ 2. upload audio

function Panel2() {
  const [name, setName] = useState("");
  const [forensics, setForensics] = useState<ForensicsResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [url, setUrl] = useState<string | null>(null);

  const onFile = async (f: File) => {
    setName(f.name);
    setErr("");
    setBusy(true);
    setForensics(null);
    setUrl(URL.createObjectURL(f));
    try {
      setForensics(await analyseAudio(f));
    } catch (e) {
      setErr(`Could not read this file: ${(e as Error).message}`);
    }
    setBusy(false);
  };

  return (
    <Card
      n="02"
      title="Upload audio: real or synthetic"
      subtitle="Measured acoustic properties, computed in this browser. These are indicators, not a trained deepfake classifier, and we say so on purpose."
    >
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-md px-4 py-2.5 text-sm font-semibold" style={{ background: "var(--accent)", color: "#0c1316" }}>
          Choose an audio file
          <input type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
        {name && (
          <span className="mono text-xs" style={{ color: "var(--muted)" }}>
            {name}
          </span>
        )}
        {busy && <span className="text-sm">analysing...</span>}
      </div>
      {url && <audio controls src={url} className="mt-4 w-full" />}
      {err && (
        <p className="mt-3 text-sm" style={{ color: "var(--critical)" }}>
          {err}
        </p>
      )}
      {forensics && (
        <div className="mt-5">
          <div className="rounded-md p-4" style={{ background: forensics.humanScore > 0.6 ? "var(--safe-tint)" : "var(--crit-tint)" }}>
            <p className="text-2xl font-bold">{forensics.verdict}</p>
            <p className="mt-1 text-sm">{forensics.summary}</p>
            <p className="mono mt-2 text-xs" style={{ color: "var(--muted)" }}>
              {forensics.durationSec.toFixed(1)} s · {forensics.sampleRate} Hz
            </p>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {["Measurement", "Value", "What it means"].map((h) => (
                    <th key={h} className="mono px-3 py-2 text-left text-[11px] uppercase tracking-wider" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {forensics.findings.map((f) => (
                  <tr key={f.name} style={{ background: "var(--surface-2)" }}>
                    <td className="px-3 py-2" style={{ borderTop: "1px solid var(--hairline)" }}>
                      {f.name}
                    </td>
                    <td className="mono px-3 py-2" style={{ borderTop: "1px solid var(--hairline)", color: f.suspicious ? "var(--critical)" : "var(--ink)" }}>
                      {f.value}
                    </td>
                    <td className="px-3 py-2" style={{ borderTop: "1px solid var(--hairline)", color: "var(--muted)" }}>
                      {f.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------ 3. money split and live map

interface Split {
  id: string;
  label: string;
  amount: number;
}

function Panel3() {
  const [stolen, setStolen] = useState(50000);
  const [layer1, setLayer1] = useState<Split[]>(Array.from({ length: 10 }, (_, i) => ({ id: `M${i + 1}`, label: `Mule ${i + 1}`, amount: 5000 })));
  const [layer2Count, setLayer2Count] = useState(5);
  const [detected, setDetected] = useState(false);
  const [revealed, setRevealed] = useState(0);
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // build the tree the user described, then run the real Proportional Freeze engine on it
  const nodes = useMemo<TraceNode[]>(() => {
    const out: TraceNode[] = [];
    const l1Total = layer1.reduce((a, s) => a + s.amount, 0);
    const push = (n: Omit<TraceNode, "taint" | "held">) => out.push({ ...n, taint: 0, held: 0 });
    push({ id: "V", hop: 0, label: "Victim", vpa: "lakshmi@fedbank", kind: "victim", balanceBefore: 84320, received: 0, forwarded: stolen, settlement: false, parentId: null, revealed: true });
    push({ id: "S", hop: 1, label: "Scammer", vpa: "verification-desk@fedbank", kind: "scammer", balanceBefore: 0, received: stolen, forwarded: Math.min(stolen, l1Total), settlement: false, parentId: "V", revealed: false });
    for (const s of layer1) {
      const onward = Math.round(s.amount * 0.7);
      push({ id: s.id, hop: 2, label: s.label, vpa: `${s.id.toLowerCase()}@okbank`, kind: "mule", balanceBefore: 0, received: s.amount, forwarded: onward, settlement: onward === 0, parentId: "S", revealed: false });
    }
    // the first three mules each split onward, one of the receivers being an innocent shop
    for (const s of layer1.slice(0, 3)) {
      const each = Math.round((s.amount * 0.7) / Math.max(1, layer2Count));
      for (let j = 0; j < layer2Count; j++) {
        const merchant = j === 0;
        push({
          id: `${s.id}-${j + 1}`,
          hop: 3,
          label: merchant ? "Shop (innocent)" : `Receiver ${j + 1}`,
          vpa: `${s.id.toLowerCase()}.r${j + 1}@ybl`,
          kind: merchant ? "merchant" : "mule",
          balanceBefore: merchant ? 200000 : 0,
          received: each,
          forwarded: merchant ? Math.round(each * 0.1) : 0,
          settlement: true,
          parentId: s.id,
          revealed: false,
        });
      }
    }
    return propagateTaint(out);
  }, [stolen, layer1, layer2Count]);

  const shown = nodes.map((n) => ({ ...n, revealed: n.hop <= revealed }));
  const recovered = shown.filter((n) => n.revealed).reduce((a, n) => a + n.held, 0);
  const elapsed = started ? Math.floor((now - started) / 1000) : 0;
  const remaining = Math.max(0, 3600 - elapsed);
  const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const maxHop = nodes.reduce((m, n) => Math.max(m, n.hop), 0);

  useEffect(() => {
    if (!detected || revealed >= maxHop) return;
    const t = setTimeout(() => setRevealed((r) => r + 1), 2200);
    return () => clearTimeout(t);
  }, [detected, revealed, maxHop]);

  const byHop = useMemo(() => {
    const m = new Map<number, typeof shown>();
    for (const n of shown) if (n.revealed && n.hop > 0) m.set(n.hop, [...(m.get(n.hop) ?? []), n]);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [shown]);

  const allocated = layer1.reduce((a, s) => a + s.amount, 0);

  return (
    <Card n="03" title="Where the money went" subtitle="Enter what the scammer took and how it was split. Then press Scam detected and watch it map, hop by hop, against the clock.">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm">
          <span className="mono block text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Amount stolen
          </span>
          <input
            type="number"
            value={stolen}
            onChange={(e) => setStolen(Math.max(0, Number(e.target.value)))}
            className="mono mt-1 w-40 rounded-md px-3 py-2 text-lg"
            style={{ background: "var(--surface-2)", color: "var(--ink)" }}
          />
        </label>
        <label className="text-sm">
          <span className="mono block text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Each mule splits to
          </span>
          <input
            type="number"
            min={1}
            max={10}
            value={layer2Count}
            onChange={(e) => setLayer2Count(Math.min(10, Math.max(1, Number(e.target.value))))}
            className="mono mt-1 w-28 rounded-md px-3 py-2 text-lg"
            style={{ background: "var(--surface-2)", color: "var(--ink)" }}
          />
        </label>
        <Btn kind="primary" onClick={() => setLayer1((l) => l.map((s) => ({ ...s, amount: Math.round(stolen / l.length) })))}>
          Split evenly
        </Btn>
        <Btn
          kind="danger"
          onClick={() => {
            setDetected(true);
            setStarted(Date.now());
            setRevealed(1);
          }}
        >
          Scam detected · start tracing
        </Btn>
        <Btn
          onClick={() => {
            setDetected(false);
            setRevealed(0);
            setStarted(null);
          }}
        >
          Reset
        </Btn>
      </div>

      <p className="mono mb-2 mt-5 text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
        The 10 accounts the scammer sent it to
      </p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {layer1.map((s, i) => (
          <div key={s.id} className="rounded-md p-3" style={{ background: "var(--surface-2)" }}>
            <span className="mono text-[11px]" style={{ color: "var(--accent)" }}>
              {s.id}
            </span>
            <input
              type="number"
              value={s.amount}
              onChange={(e) => setLayer1((l) => l.map((x, j) => (j === i ? { ...x, amount: Math.max(0, Number(e.target.value)) } : x)))}
              className="mono mt-1 w-full rounded bg-transparent text-lg font-bold outline-none"
              style={{ color: "var(--ink)" }}
            />
          </div>
        ))}
      </div>
      <p className="mono mt-2 text-xs" style={{ color: allocated > stolen ? "var(--critical)" : "var(--muted)" }}>
        allocated {inr(allocated)} of {inr(stolen)}
      </p>

      {detected && (
        <div className="mt-6">
          <div className="grid gap-px md:grid-cols-4" style={{ background: "var(--hairline)" }}>
            <Stat label="Golden hour left" value={mmss(remaining)} tone={remaining < 900 ? "critical" : "accent"} />
            <Stat label="Since it left" value={mmss(elapsed)} />
            <Stat label="Stolen" value={inr(stolen)} />
            <Stat label="Recoverable" value={inr(recovered)} tone="safe" sub={`${Math.round((recovered / Math.max(1, stolen)) * 100)}%`} />
          </div>

          <div className="mt-5 grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(1, byHop.length)}, minmax(0,1fr))` }}>
            {byHop.map(([hop, ns]) => (
              <div key={hop}>
                <p className="mono mb-2 text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  Hop {hop} · {ns.length}
                </p>
                <ul className="space-y-2">
                  {ns.map((n) => (
                    <li
                      key={n.id}
                      className="lamp rounded-md p-3 text-sm"
                      style={{
                        background: "var(--surface-2)",
                        borderLeft: `3px solid ${n.held > 0 ? "var(--critical)" : n.kind === "merchant" ? "var(--safe)" : "var(--hairline)"}`,
                      }}
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold">{n.label}</span>
                        <span className="mono">{inr(n.received)}</span>
                      </div>
                      <div className="mono mt-1 flex justify-between text-[11px]">
                        <span style={{ color: n.held ? "var(--critical)" : "var(--muted)" }}>held {inr(n.held)}</span>
                        <span style={{ color: "var(--safe)" }}>free {inr(currentBalance(n) - n.held)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
            Proportional Freeze: only the stolen rupees are held. Anything under {inr(FLOOR)} stops propagating, so the innocent shop keeps its own money.
          </p>
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value, tone, sub }: { label: string; value: string; tone?: "accent" | "safe" | "critical"; sub?: string }) {
  const color = tone === "safe" ? "var(--safe)" : tone === "critical" ? "var(--critical)" : tone === "accent" ? "var(--accent)" : "var(--ink)";
  return (
    <div className="p-4" style={{ background: "var(--surface-2)" }}>
      <p className="mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
        {label}
      </p>
      <p className="mono mt-1 text-3xl font-bold" style={{ color }}>
        {value}
      </p>
      {sub && (
        <p className="mono text-xs" style={{ color: "var(--muted)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ 4. booking agent

function Panel4() {
  const [trip, setTrip] = useState<"cheap" | "expensive">("cheap");
  const [limit, setLimit] = useState(AGENT_LIMIT);
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState<"paid" | "asked" | null>(null);

  const run = () => {
    const t = AGENT_TRIPS[trip];
    setDone(null);
    setLog([]);
    const steps = [
      `Looking for the official site for ${t.from} to ${t.to}.`,
      `Found ${t.site}. Ignored 3 look-alike sites in the search results.`,
      `Filled passenger details for ${t.date}. Fare ${inr(t.price)}.`,
    ];
    steps.forEach((s, i) => setTimeout(() => setLog((l) => [...l, s]), 900 * (i + 1)));
    setTimeout(() => {
      if (t.price <= limit) {
        setLog((l) => [...l, `${inr(t.price)} is within your ${inr(limit)} limit. Paid.`]);
        setDone("paid");
      } else {
        setLog((l) => [...l, `${inr(t.price)} is above your ${inr(limit)} limit. Asking Priya before paying.`]);
        setDone("asked");
      }
    }, 900 * 4);
  };

  return (
    <Card n="04" title="The agent that books and pays" subtitle="A senior says what she wants. The agent finds the official site, fills the details, and pays only up to the limit she set.">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm">
          <span className="mono block text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Trip
          </span>
          <select value={trip} onChange={(e) => setTrip(e.target.value as "cheap" | "expensive")} className="mt-1 rounded-md px-3 py-2" style={{ background: "var(--surface-2)", color: "var(--ink)" }}>
            <option value="cheap">
              {AGENT_TRIPS.cheap.label} · {inr(AGENT_TRIPS.cheap.price)}
            </option>
            <option value="expensive">
              {AGENT_TRIPS.expensive.label} · {inr(AGENT_TRIPS.expensive.price)}
            </option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mono block text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Spending limit she set
          </span>
          <input type="number" value={limit} onChange={(e) => setLimit(Math.max(0, Number(e.target.value)))} className="mono mt-1 w-36 rounded-md px-3 py-2 text-lg" style={{ background: "var(--surface-2)", color: "var(--ink)" }} />
        </label>
        <Btn kind="primary" onClick={run}>
          Ask the agent to book it
        </Btn>
      </div>
      {log.length > 0 && (
        <ol className="mt-5 space-y-2">
          {log.map((l, i) => (
            <li key={i} className="rounded-md px-4 py-3 text-sm" style={{ background: "var(--surface-2)" }}>
              {l}
            </li>
          ))}
        </ol>
      )}
      {done && (
        <div className="mt-4 rounded-md p-4" style={{ background: done === "paid" ? "var(--safe-tint)" : "var(--accent-tint)" }}>
          <p className="text-lg font-bold">{done === "paid" ? "Booked and paid, inside the limit." : "Held. Priya decides, because it is above the limit."}</p>
          <p className="mt-1 text-sm">The agent can never spend more than she allowed, which is the whole point.</p>
        </div>
      )}
    </Card>
  );
}
