"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { inr, useAct, usePoll } from "@/lib/client";
import { hesitationIndex, type KeyEvent } from "@/lib/hesitation";
import { useSpeech } from "@/lib/speech";
import { CONFERENCE_THRESHOLD } from "@/lib/screening";
import { INTERVIEW_QUESTION_HI, INTERVIEW_QUESTION_TA, VERIFIED_HELP } from "@/lib/scenario";
import { minutesAgo } from "@/lib/immunity";
import type { State } from "@/lib/types";
import { Btn, LiveBadge, Reconnecting, Simulated, Tag, TierPill } from "@/components/ui";

type Act = (type: string, payload?: Record<string, unknown>) => Promise<boolean>;

export default function PhonePage() {
  const { state, connected, serverNow, transport } = usePoll();
  const { act, error, clearError } = useAct("phone");
  const [large, setLarge] = useState(false);

  useEffect(() => {
    try {
      setLarge(localStorage.getItem("trace.large") === "1");
    } catch {}
  }, []);
  const toggleLarge = () => {
    setLarge((v) => {
      try {
        localStorage.setItem("trace.large", v ? "0" : "1");
      } catch {}
      return !v;
    });
  };

  // the booking agent advances itself, one step every 1.6 s, so the audience can read each line
  const agentActive = state?.agent.active ?? false;
  const agentStep = state?.agent.step ?? "idle";
  useEffect(() => {
    if (!agentActive) return;
    const id = setTimeout(() => void act("agent.next"), 1600);
    return () => clearTimeout(id);
  }, [agentActive, agentStep, act]);

  // real app-switch counting while a payment is being composed
  const composing = state?.payment.stage === "composing";
  useEffect(() => {
    if (!composing) return;
    const h = () => {
      if (document.visibilityState === "hidden") void act("device.appSwitch");
    };
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, [composing, act]);

  if (!state) {
    return (
      <Frame large={large}>
        <div className="p-6 text-sm" style={{ color: "var(--muted)" }}>
          Opening Fed Bank...
        </div>
      </Frame>
    );
  }

  const { call, payment, user, rehearsal } = state;
  const showCall = call.active || (call.conferenced && call.ended === "scammer_hangup" && payment.stage === "idle");

  return (
    <Frame large={large}>
      <Reconnecting connected={connected} />
      <header className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--hairline)" }}>
        <div className="flex items-baseline gap-2">
          <span className="font-bold">Fed Bank</span>
          <Simulated />
        </div>
        <div className="flex items-center gap-2">
          <LiveBadge transport={transport} />
          <button onClick={toggleLarge} className="mono text-xs underline" aria-pressed={large}>
            {large ? "Normal" : "Large"}
          </button>
        </div>
      </header>

      {error && (
        <div className="flex items-center justify-between px-4 py-2 text-sm" style={{ background: "var(--crit-tint)", color: "var(--critical)" }}>
          <span>{error}</span>
          <button onClick={clearError} className="mono text-xs underline">
            dismiss
          </button>
        </div>
      )}

      {rehearsal.active && call.isDrill ? <DrillSheet state={state} act={act} /> : showCall ? <CallSheet state={state} act={act} /> : null}

      {state.card.feed[0]?.flagged && state.card.decision === null && <CardSheet state={state} act={act} />}

      {(state.agent.active || state.agent.step === "paid" || state.agent.step === "ask_guardian") && state.agent.trip && (
        <section className="m-4 rounded-md p-4" style={{ background: "var(--surface-2)" }}>
          <div className="flex items-center justify-between">
            <p className="mono text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              TRACE agent · limit {inr(state.agent.limit)}
            </p>
            <Simulated />
          </div>
          <p className="mt-1 font-semibold">{state.agent.trip.label}</p>
          <ol className="mt-2 space-y-1 text-sm">
            {state.agent.log.map((l, i) => (
              <li key={i} style={{ color: i === state.agent.log.length - 1 ? "var(--ink)" : "var(--muted)" }}>
                {l}
              </li>
            ))}
          </ol>
        </section>
      )}

      {!rehearsal.active && rehearsal.lastResult && payment.stage === "idle" && !call.active && (
        <section className="m-4 rounded-md p-4" style={{ background: "var(--safe-tint)" }}>
          <p className="mono text-[10px] uppercase tracking-wider" style={{ color: "var(--safe)" }}>
            Rehearsal
          </p>
          <p className="mt-1 text-sm">{rehearsal.lessons[rehearsal.lessons.length - 1]}</p>
        </section>
      )}

      <main className="px-4 pb-8">
        {payment.stage === "idle" && <Home state={state} act={act} />}
        {payment.stage === "composing" && <Compose state={state} act={act} />}
        {payment.stage === "softcheck" && <SoftCheck act={act} />}
        {payment.stage === "pin" && <Pin state={state} act={act} />}
        {(payment.stage === "interview" || payment.stage === "verifying") && <Interview state={state} act={act} />}
        {payment.stage === "cosign" && <Cosign state={state} act={act} />}
        {payment.stage === "stopped" && <Stopped state={state} act={act} />}
        {payment.stage === "vetoed" && <Done title={`${user.guardianName} stopped this payment.`} body="Your money is untouched. Nothing was sent." act={act} tone="safe" />}
        {payment.stage === "success" && <Done title="Paid" body={`${inr(payment.amount)} to ${payment.payee?.name}. Ref ${payment.receiptRef}.`} act={act} tone="safe" />}
        {payment.stage === "blocked" && payment.blockedBy && (
          <Done
            title="Payment not started."
            body={`This account was reported ${minutesAgo(payment.blockedBy.reportedAt, serverNow)} by another TRACE user. Nobody on the network can pay it now.`}
            act={act}
            tone="critical"
          />
        )}
      </main>
    </Frame>
  );
}

function Frame({ children, large }: { children: React.ReactNode; large: boolean }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--surface-2)" }}>
      <div className={`mx-auto min-h-screen max-w-[420px] ${large ? "large-text" : ""}`} style={{ background: "var(--surface)", borderLeft: "1px solid var(--hairline)", borderRight: "1px solid var(--hairline)" }}>
        {children}
      </div>
    </div>
  );
}

function CallSheet({ state, act }: { state: State; act: Act }) {
  const { call, user } = state;
  const hot = call.risk >= CONFERENCE_THRESHOLD;
  return (
    <section className="m-4 rounded-lg p-4" style={{ background: "var(--ink)", color: "var(--ground)" }}>
      <p className="mono text-[10px] uppercase tracking-wider opacity-70">{call.active ? "Incoming call" : "Call ended"}</p>
      <p className="mt-1 text-lg font-semibold">{call.callerName}</p>
      <p className="mono text-xs opacity-70">{call.callerId}</p>
      {call.attestationLine && (
        <p className="mt-3 rounded-md px-3 py-2 text-sm font-semibold" style={{ background: call.attested ? "var(--safe)" : "var(--critical)", color: "#fff" }}>
          {call.attestationLine}
        </p>
      )}
      {call.conferenced && (
        <p className="mt-3 text-sm" style={{ color: "var(--safe)" }}>
          {user.guardianName} joined. The caller disconnected.
        </p>
      )}
      {call.active && (
        <div className="mt-4 flex flex-wrap gap-2">
          {hot && !call.conferenced && (
            <Btn kind="safe" onClick={() => act("call.conference")} big>
              Add {user.guardianName} to this call
            </Btn>
          )}
          <Btn kind="quiet" onClick={() => act("call.stop")}>
            <span style={{ color: "var(--ground)" }}>End call</span>
          </Btn>
        </div>
      )}
    </section>
  );
}

function CardSheet({ state, act }: { state: State; act: Act }) {
  const t = state.card.feed[0];
  return (
    <section className="m-4 rounded-lg p-4" style={{ background: "var(--crit-tint)", borderLeft: "3px solid var(--critical)" }}>
      <div className="flex items-center justify-between">
        <p className="mono text-[10px] uppercase tracking-wider" style={{ color: "var(--critical)" }}>
          Card payment held
        </p>
        <Simulated />
      </div>
      <p className="mt-1 text-xl font-bold">
        {inr(t.tx.amount)} · {t.tx.type.toLowerCase().replace("_", " ")}
      </p>
      <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
        Matches a fraud pattern{t.reasons.length ? `: ${t.reasons.join("; ")}` : ""}. Was this you?
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Btn kind="danger" onClick={() => act("card.decide", { decision: "notme" })}>
          Not me
        </Btn>
        <Btn kind="quiet" onClick={() => act("card.decide", { decision: "approve" })}>
          Yes, it was me
        </Btn>
      </div>
    </section>
  );
}

function DrillSheet({ state, act }: { state: State; act: Act }) {
  const { call, user } = state;
  return (
    <section className="m-4 rounded-lg p-4" style={{ background: "var(--ink)", color: "var(--ground)" }}>
      <p className="mono text-[10px] uppercase tracking-wider opacity-70">Incoming call</p>
      <p className="mt-1 text-lg font-semibold">{call.callerName}</p>
      {call.attestationLine && (
        <p className="mt-3 rounded-md px-3 py-2 text-sm font-semibold" style={{ background: "var(--critical)", color: "#fff" }}>
          {call.attestationLine}
        </p>
      )}
      <ul className="mt-3 space-y-2 text-sm opacity-90">
        {call.transcript.map((l, i) => (
          <li key={i}>“{l.text}”</li>
        ))}
      </ul>
      <p className="mt-4 text-sm opacity-80">What do you do?</p>
      <div className="mt-2 grid gap-2">
        <Btn kind="danger" onClick={() => act("drill.choose", { choice: "comply" })}>
          Pay the penalty
        </Btn>
        <Btn kind="safe" onClick={() => act("drill.choose", { choice: "ask" })}>
          Ask {user.guardianName} first
        </Btn>
        <Btn kind="quiet" onClick={() => act("drill.choose", { choice: "hangup" })}>
          <span style={{ color: "var(--ground)" }}>Hang up</span>
        </Btn>
      </div>
    </section>
  );
}

function Home({ state, act }: { state: State; act: Act }) {
  const [q, setQ] = useState("");
  const [vpa, setVpa] = useState("");
  const [pasted, setPasted] = useState(false);
  const hit = useMemo(() => VERIFIED_HELP.find((h) => q.trim().length > 2 && h.match.test(q)), [q]);
  const hitName = hit?.name;
  useEffect(() => {
    if (hitName) void act("search.query", { q });
    // only when the matched entry changes, not on every keystroke
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hitName]);

  return (
    <div className="space-y-5 pt-4">
      <div className="rounded-lg p-4" style={{ background: "var(--ink)", color: "var(--ground)" }}>
        <p className="mono text-[10px] uppercase tracking-wider opacity-70">Savings · {state.user.vpa}</p>
        <p className="mt-1 text-3xl font-bold">{inr(state.user.balance)}</p>
      </div>

      <div>
        <p className="mono mb-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          Pay again
        </p>
        <div className="grid grid-cols-2 gap-2">
          {state.user.payees.map((p) => (
            <button key={p.id} onClick={() => act("pay.select", { payeeId: p.id })} className="rounded-md px-3 py-3 text-left" style={{ background: "var(--surface-2)" }}>
              <span className="block font-semibold">{p.name}</span>
              <span className="mono block text-xs" style={{ color: "var(--muted)" }}>
                {p.vpa}
              </span>
              {p.kind === "lender" && (
                <span className="mt-1 inline-block">
                  <Tag tone="accent">Loan app</Tag>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (vpa.includes("@")) void act("pay.select", { vpa: vpa.trim(), pasted });
        }}
      >
        <p className="mono text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          Pay someone new
        </p>
        <div className="flex gap-2">
          <input
            value={vpa}
            onChange={(e) => setVpa(e.target.value)}
            onPaste={() => setPasted(true)}
            placeholder="name@bank"
            className="mono flex-1 rounded-md px-3 py-2"
            style={{ background: "var(--surface-2)", color: "var(--ink)" }}
            aria-label="UPI ID"
          />
          <Btn type="submit" disabled={!vpa.includes("@")}>
            Next
          </Btn>
        </div>
      </form>

      <div className="space-y-2">
        <p className="mono text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          Ask TRACE to book a train
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Btn kind="quiet" onClick={() => act("agent.start", { trip: "cheap" })}>
            Madurai, 12 Sept
          </Btn>
          <Btn kind="quiet" onClick={() => act("agent.start", { trip: "expensive" })}>
            Delhi, 12 Sept
          </Btn>
        </div>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          The agent finds the official site, books, and pays only up to the {inr(state.agent.limit)} limit you set. Above that it asks {state.user.guardianName}.
        </p>
      </div>

      <div className="space-y-2">
        <p className="mono text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          Search
        </p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. customer care number" className="w-full rounded-md px-3 py-2" style={{ background: "var(--surface-2)", color: "var(--ink)" }} aria-label="Search" />
        {hit && (
          <div className="rounded-md p-3" style={{ background: "var(--safe-tint)", borderLeft: "3px solid var(--safe)" }}>
            <div className="flex items-center gap-2">
              <Tag tone="safe">Verified</Tag>
              <span className="font-semibold">{hit.name}</span>
            </div>
            <p className="mono mt-1 text-xl">{hit.number}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
              {hit.note}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Compose({ state, act }: { state: State; act: Act }) {
  const { payment } = state;
  const [amount, setAmount] = useState("");
  const keys = useRef<KeyEvent[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  const n = Number(amount);
  const valid = n > 0 && n <= state.user.balance;

  const submit = () => {
    if (!valid) return;
    const hi = hesitationIndex(keys.current);
    void act("pay.review", { amount: n, signals: { hesitationIndex: hi } });
  };

  return (
    <div className="space-y-5 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{payment.payee?.name}</p>
          <p className="mono text-xs" style={{ color: "var(--muted)" }}>
            {payment.payee?.vpa}
          </p>
        </div>
        {payment.payee?.known ? <Tag tone="safe">Paid before</Tag> : <Tag tone="accent">{payment.pasted ? "New · pasted" : "New payee"}</Tag>}
      </div>
      <div>
        <label className="mono text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }} htmlFor="amt">
          Amount
        </label>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl">₹</span>
          <input
            id="amt"
            ref={inputRef}
            inputMode="numeric"
            value={amount}
            onKeyDown={(e) => {
              if (e.key === "Backspace" || /^[0-9]$/.test(e.key)) keys.current.push({ t: performance.now(), key: e.key });
              if (e.key === "Enter") submit();
            }}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            className="w-full bg-transparent text-4xl font-bold outline-none"
            placeholder="0"
            aria-describedby="amt-help"
          />
        </div>
        <p id="amt-help" className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          Typing rhythm is measured on this phone only. It never leaves the device.
        </p>
      </div>
      <div className="flex gap-2">
        <Btn onClick={submit} disabled={!valid} big>
          Continue
        </Btn>
        <Btn kind="quiet" onClick={() => act("pay.cancel")}>
          Cancel
        </Btn>
      </div>
    </div>
  );
}

function SoftCheck({ act }: { act: Act }) {
  return (
    <div className="space-y-4 pt-6">
      <p className="text-xl font-semibold">Is this someone you have paid before?</p>
      <div className="grid grid-cols-2 gap-2">
        <Btn onClick={() => act("pay.check", { knownBefore: true })} big>
          Yes
        </Btn>
        <Btn kind="quiet" onClick={() => act("pay.check", { knownBefore: false })} big>
          No
        </Btn>
      </div>
    </div>
  );
}

function Pin({ state, act }: { state: State; act: Act }) {
  const [pin, setPin] = useState("");
  useEffect(() => {
    if (pin.length === 4) {
      void act("pay.pin", { pin }).then((ok) => {
        if (!ok) setPin("");
      });
    }
  }, [pin, act]);
  const press = (k: string) => setPin((p) => (k === "⌫" ? p.slice(0, -1) : p.length < 4 ? p + k : p));
  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <span>
          {inr(state.payment.amount)} to <strong>{state.payment.payee?.name}</strong>
        </span>
        <TierPill tier={state.payment.tier} />
      </div>
      <p className="text-center text-lg font-semibold">Enter UPI PIN</p>
      <p className="mono text-center text-3xl tracking-[0.6em]">{"●".repeat(pin.length).padEnd(4, "○")}</p>
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) => (
          <button key={i} disabled={!k} onClick={() => press(k)} className="rounded-md py-4 text-xl font-semibold disabled:opacity-0" style={{ background: "var(--surface-2)" }} aria-label={k === "⌫" ? "Delete" : k}>
            {k}
          </button>
        ))}
      </div>
      <p className="text-center text-xs" style={{ color: "var(--muted)" }}>
        Demo PINs: 4471 real · 9999 safety PIN
      </p>
    </div>
  );
}

function Interview({ state, act }: { state: State; act: Act }) {
  const { payment, user } = state;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const speech = useSpeech((t) => setText((prev) => (prev ? prev + " " + t : t)));

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    speech.stop();
    await act("interview.answer", { text: text.trim() });
    setBusy(false);
  };

  return (
    <div className="space-y-4 pt-4">
      {payment.stage === "verifying" && (
        <div className="rounded-md p-4" style={{ background: "var(--accent-tint)", borderLeft: "3px solid var(--accent)" }}>
          <div className="flex items-center justify-between">
            <p className="font-semibold">Payment under bank verification</p>
            <Simulated />
          </div>
          <p className="mono mt-1 text-sm">Ref {payment.receiptRef} · 30 minutes</p>
          <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
            {inr(payment.amount)} to {payment.payee?.name}. {user.guardianName} has been told.
          </p>
        </div>
      )}
      <div>
        <p className="text-xl font-semibold" style={{ textWrap: "balance" }}>
          {payment.interview?.question}
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
          {INTERVIEW_QUESTION_TA}
        </p>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
          {INTERVIEW_QUESTION_HI}
        </p>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={speech.supported ? "Tap the microphone, or type here" : "Type here"} className="w-full rounded-md p-3" style={{ background: "var(--surface-2)", color: "var(--ink)" }} aria-label="Your answer" />
      {speech.interim && (
        <p className="text-sm italic" style={{ color: "var(--muted)" }}>
          {speech.interim}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {speech.supported && (
          <Btn kind={speech.listening ? "danger" : "quiet"} onClick={() => (speech.listening ? speech.stop() : speech.start())}>
            {speech.listening ? "Listening... tap to stop" : "🎤 Speak"}
          </Btn>
        )}
        <Btn onClick={submit} disabled={!text.trim() || busy} big>
          {busy ? "Checking..." : "That's why"}
        </Btn>
        <Btn kind="quiet" onClick={() => act("pay.cancel")}>
          Cancel payment
        </Btn>
      </div>
    </div>
  );
}

function Rebuttal({ state }: { state: State }) {
  const c = state.payment.interview?.classification;
  if (!c) return null;
  return (
    <div className="rounded-md p-4" style={{ background: "var(--crit-tint)", borderLeft: "3px solid var(--critical)" }}>
      <p className="mono text-[10px] uppercase tracking-wider" style={{ color: "var(--critical)" }}>
        {c.scam === "unknown" ? "Pressure detected" : `Recognised · ${Math.round(c.confidence * 100)}% match`}
      </p>
      <p className="mt-1 text-2xl font-bold" style={{ textWrap: "balance" }}>
        {c.label}
      </p>
      <p className="mt-2">{c.rebuttalWarm ?? c.rebuttal}</p>
      <p className="mt-3 text-sm" style={{ color: "var(--ink-soft)" }}>
        {c.stat}
      </p>
      <p className="mono mt-1 text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
        Source: {c.source}
      </p>
    </div>
  );
}

function Cosign({ state, act }: { state: State; act: Act }) {
  return (
    <div className="space-y-4 pt-4">
      <Rebuttal state={state} />
      <div className="flex items-center justify-between rounded-md p-3" style={{ background: "var(--surface-2)" }}>
        <span>
          Waiting for <strong>{state.user.guardianName}</strong>
          <span className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full" style={{ background: "var(--accent)" }} />
        </span>
        <Btn kind="quiet" onClick={() => act("pay.cancel")}>
          Cancel payment
        </Btn>
      </div>
    </div>
  );
}

function Stopped({ state, act }: { state: State; act: Act }) {
  return (
    <div className="space-y-4 pt-4">
      <p className="mono text-[10px] uppercase tracking-wider" style={{ color: "var(--critical)" }}>
        Payment stopped
      </p>
      {state.lenderCheck && !state.lenderCheck.registered && (
        <div className="rounded-md p-3 text-sm" style={{ background: "var(--accent-tint)" }}>
          <div className="flex items-center justify-between">
            <span className="font-semibold">Lender check</span>
            <Simulated />
          </div>
          <p className="mt-1">{state.lenderCheck.reason}</p>
        </div>
      )}
      <Rebuttal state={state} />
      <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
        {state.user.guardianName} has been sent everything about this call.
      </p>
      <Btn kind="quiet" onClick={() => act("pay.cancel")}>
        Back to home
      </Btn>
    </div>
  );
}

function Done({ title, body, act, tone }: { title: string; body: string; act: Act; tone: "safe" | "critical" }) {
  return (
    <div className="space-y-4 pt-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl" style={{ background: tone === "safe" ? "var(--safe-tint)" : "var(--crit-tint)", color: tone === "safe" ? "var(--safe)" : "var(--critical)" }}>
        {tone === "safe" ? "✓" : "⛔"}
      </div>
      <p className="text-2xl font-bold" style={{ textWrap: "balance" }}>
        {title}
      </p>
      <p style={{ color: "var(--ink-soft)" }}>{body}</p>
      <Btn onClick={() => act("pay.cancel")}>Done</Btn>
    </div>
  );
}
