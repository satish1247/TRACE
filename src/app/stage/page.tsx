"use client";

import { useEffect, useMemo, useState } from "react";
import { inr, inr2, mmss, useAct, usePoll } from "@/lib/client";
import { useSpeech } from "@/lib/speech";
import { SCENARIOS } from "@/lib/scenario";
import { kindsPresent } from "@/lib/screening";
import { minutesAgo } from "@/lib/immunity";
import type { State, TraceNode } from "@/lib/types";
import { CARD_MODEL } from "@/lib/cardModel";
import { Bar, Btn, LiveBadge, MarkerLamps, Reconnecting, Simulated, Tag, TierPill } from "@/components/ui";

type Tab = "call" | "coercion" | "trace" | "network" | "card";
const TABS: Tab[] = ["call", "coercion", "trace", "network", "card"];
type Act = (type: string, payload?: Record<string, unknown>) => Promise<boolean>;

function autoTab(s: State): Tab {
  if (s.stagePin !== "auto") return s.stagePin;
  if (s.beat === 6) return "card";
  if (s.beat === 5) return "network";
  if (s.beat === 4) return "trace";
  if (s.beat === 3) return s.payment.stage === "composing" ? "call" : "coercion";
  if (s.beat === 2) return "call";
  if (s.call.active) return "call";
  return "coercion";
}

export default function StagePage() {
  const { state, connected, transport, clients } = usePoll();
  const { act } = useAct("stage");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const callActive = state?.call.active ?? false;
  const cursor = state?.call.cursor ?? 0;
  const scenario = state?.call.scenario ?? null;
  const isDrill = state?.call.isDrill ?? false;
  // the stage drives the scripted call forward, one line every 2.6 s
  useEffect(() => {
    if (!callActive || !scenario || isDrill) return;
    if (cursor >= SCENARIOS[scenario].lines.length) return;
    const id = setTimeout(() => void act("call.advance"), 2600);
    return () => clearTimeout(id);
  }, [callActive, cursor, scenario, isDrill, act]);

  const traceActive = state?.trace.active ?? false;
  const revealed = state?.trace.revealedHops ?? 0;
  const maxHop = state?.trace.maxHop ?? 0;
  const beat = state?.beat ?? 0;
  // and the trace forward, one hop every 3 s during beat 4
  useEffect(() => {
    if (!traceActive || beat !== 4 || revealed >= maxHop) return;
    const id = setTimeout(() => void act("trace.advance"), 3000);
    return () => clearTimeout(id);
  }, [traceActive, revealed, maxHop, beat, act]);

  const cardRunning = state?.card.running ?? false;
  const cardCursor = state?.card.cursor ?? 0;
  // and the card feed, one scored transaction every 1.2 s
  useEffect(() => {
    if (!cardRunning) return;
    const id = setTimeout(() => void act("card.tick"), 1200);
    return () => clearTimeout(id);
  }, [cardRunning, cardCursor, act]);

  if (!state) return <div className="stage-dark min-h-screen p-8">Connecting...</div>;
  const tab = autoTab(state);

  return (
    <div className="stage-dark min-h-screen" style={{ background: "var(--ground)", color: "var(--ink)" }}>
      <Reconnecting connected={connected} />
      <header className="flex items-center justify-between px-8 py-4" style={{ borderBottom: "1px solid var(--hairline)" }}>
        <div className="flex items-baseline gap-4">
          <span className="text-2xl font-bold tracking-tight">
            TR<span style={{ color: "var(--accent)" }}>A</span>CE
          </span>
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            Banks check the payment. TRACE checks whether the person is free.
          </span>
        </div>
        <nav className="flex items-center gap-1">
          <span className="mr-2">
            <LiveBadge transport={transport} clients={clients} />
          </span>
          {TABS.map((t) => (
            <button key={t} onClick={() => act("stage.pin", { tab: state.stagePin === t ? "auto" : t })} className="mono rounded-sm px-3 py-1.5 text-xs uppercase tracking-wider" style={{ background: tab === t ? "var(--accent)" : "var(--surface)", color: tab === t ? "#0c1316" : "var(--muted)" }}>
              {t}
              {state.stagePin === t ? " ·" : ""}
            </button>
          ))}
        </nav>
      </header>
      <main className="p-8">
        {tab === "call" && <CallTab state={state} act={act} />}
        {tab === "coercion" && <CoercionTab state={state} />}
        {tab === "trace" && <TraceTab state={state} act={act} now={now} />}
        {tab === "network" && <NetworkTab state={state} now={now} />}
        {tab === "card" && <CardTab state={state} act={act} />}
      </main>
      <footer className="mono px-8 pb-6 text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
        Beat {state.beat} · every bank, NPCI, police and FIU rail on this screen is simulated
      </footer>
    </div>
  );
}

function CallTab({ state, act }: { state: State; act: Act }) {
  const { call, network } = state;
  const speech = useSpeech((t) => void act("call.liveLine", { text: t }), { continuous: true });
  const present = kindsPresent(call.markers);
  const rep = network.reputation[call.callerId];
  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">{call.active ? "Live call" : call.transcript.length ? "Call ended" : "No call"}</h2>
          <span className="mono text-xs" style={{ color: "var(--muted)" }}>
            {call.callerName} {call.callerId && `· ${call.callerId}`}
            {rep?.flagged && (
              <span className="ml-2">
                <Tag tone="critical">Flagged {rep.reports}×</Tag>
              </span>
            )}
          </span>
        </div>
        <ol className="mt-4 space-y-3">
          {call.transcript.map((l, i) => {
            const hits = call.markers.filter((m) => m.lineIndex === i);
            return (
              <li key={i} className="rounded-md p-4 text-lg" style={{ background: l.speaker === "system" ? "var(--safe-tint)" : "var(--surface)", borderLeft: hits.length ? "3px solid var(--critical)" : "3px solid transparent" }}>
                {l.text}
                {hits.length > 0 && (
                  <span className="mt-2 flex flex-wrap gap-2">
                    {hits.map((h, j) => (
                      <Tag key={j} tone={h.kind === "isolation" || h.kind === "blocking" ? "critical" : "accent"}>
                        {h.kind}
                      </Tag>
                    ))}
                  </span>
                )}
              </li>
            );
          })}
          {call.transcript.length === 0 && (
            <li className="text-sm" style={{ color: "var(--muted)" }}>
              The transcript appears when a call starts.
            </li>
          )}
        </ol>
        {speech.supported && (
          <div className="mt-6 flex items-center gap-3">
            <Btn kind={speech.listening ? "danger" : "quiet"} onClick={() => (speech.listening ? speech.stop() : speech.start())} disabled={!call.active}>
              <span style={{ color: speech.listening ? "#fff" : "var(--ink)" }}>{speech.listening ? "Listening to the room... stop" : "🎤 Let a judge play the scammer"}</span>
            </Btn>
            {speech.interim && (
              <span className="text-sm italic" style={{ color: "var(--muted)" }}>
                {speech.interim}
              </span>
            )}
          </div>
        )}
      </section>

      <aside className="space-y-6">
        <div>
          <p className="mono mb-2 text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Script markers · detected by words, not by voice
          </p>
          <MarkerLamps present={present} />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <p className="mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              Call risk
            </p>
            <span className="mono text-3xl font-bold">{call.risk}</span>
          </div>
          <Bar value={call.risk} max={100} tone={call.risk >= 45 ? "critical" : "accent"} />
        </div>
        {call.attestationLine && (
          <div className="rounded-md p-4" style={{ background: call.attested ? "var(--safe-tint)" : "var(--crit-tint)", color: call.attested ? "var(--safe)" : "var(--critical)" }}>
            <p className="mono text-[11px] uppercase tracking-wider">Caller attestation</p>
            <p className="mt-1 font-semibold">{call.attestationLine}</p>
          </div>
        )}
        {call.classification && call.classification.scam !== "unknown" && (
          <div className="rounded-md p-4" style={{ background: "var(--surface)" }}>
            <p className="mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              Script recognised
            </p>
            <p className="mt-1 text-xl font-semibold">{call.classification.label}</p>
            <p className="mono mt-1 text-xs" style={{ color: "var(--muted)" }}>
              fingerprint {call.fingerprint}
            </p>
          </div>
        )}
        {call.conferenced && (
          <div className="rounded-md p-4" style={{ background: "var(--safe-tint)", color: "var(--safe)" }}>
            <p className="font-semibold">{state.user.guardianName} joined the call. The caller disconnected in under a second.</p>
          </div>
        )}
        {call.mediaCheck && (
          <div className="rounded-md p-4" style={{ background: "var(--surface)" }}>
            <div className="flex items-baseline justify-between">
              <p className="mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                Audio authenticity · second engine
              </p>
              <Simulated />
            </div>
            <p className="mt-1 text-lg font-semibold">
              {call.mediaCheck.label}:{" "}
              <span style={{ color: call.mediaCheck.verdict === "authentic" ? "var(--safe)" : "var(--critical)" }}>
                {call.mediaCheck.verdict} · {Math.round(call.mediaCheck.authenticity * 100)}% human
              </span>
            </p>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {call.mediaCheck.signals.map((sg) => (
                <li key={sg.name} className="flex justify-between gap-2">
                  <span style={{ color: "var(--muted)" }}>{sg.name}</span>
                  <span style={{ color: sg.suspicious ? "var(--critical)" : "var(--ink)" }}>{sg.value}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm" style={{ color: "var(--accent)" }}>
              {call.mediaCheck.note}
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

function CoercionTab({ state }: { state: State }) {
  const { payment, user, guardian } = state;
  const c = payment.interview?.classification;
  const decided = [...guardian.requests].reverse()[0];
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
      <section>
        <p className="mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          Coercion score · computed on the phone, only the score leaves it
        </p>
        <div className="mt-2 flex items-end gap-4">
          <span className="text-7xl font-bold leading-none">{payment.score}</span>
          <TierPill tier={payment.tier} />
        </div>
        {payment.payee && (
          <p className="mt-3 text-lg">
            {inr(payment.amount)} to <strong>{payment.payee.name}</strong> · <span style={{ color: "var(--muted)" }}>{payment.reason}</span>
          </p>
        )}
        <ul className="mt-6 space-y-3">
          {payment.breakdown.map((b) => (
            <li key={b.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span>{b.label}</span>
                <span className="mono" style={{ color: b.points ? "var(--accent)" : "var(--muted)" }}>
                  {b.points}/{b.max}
                </span>
              </div>
              <Bar value={b.points} max={b.max} tone={b.points ? "accent" : "safe"} />
              <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                {b.note}
              </p>
            </li>
          ))}
          {payment.breakdown.length === 0 && (
            <li className="text-sm" style={{ color: "var(--muted)" }}>
              Scores appear when Lakshmi taps Continue on a payment.
            </li>
          )}
        </ul>
      </section>
      <section className="space-y-4">
        {payment.duress && (
          <div className="rounded-md p-4" style={{ background: "var(--crit-tint)", color: "var(--critical)" }}>
            <p className="mono text-[11px] uppercase tracking-wider">Safety PIN</p>
            <p className="mt-1 font-semibold">She entered the duress PIN. The phone shows a true “under verification” receipt ({payment.receiptRef}); nothing has moved.</p>
          </div>
        )}
        {payment.interview?.answer && (
          <blockquote className="rounded-md p-4 text-xl italic" style={{ background: "var(--surface)" }}>
            “{payment.interview.answer}”
            <span className="mono mt-2 block text-[11px] not-italic uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              Lakshmi, in her own words
            </span>
          </blockquote>
        )}
        {c && (
          <div className="rounded-md p-5" style={{ background: "var(--crit-tint)", borderLeft: "4px solid var(--critical)" }}>
            <p className="mono text-[11px] uppercase tracking-wider" style={{ color: "var(--critical)" }}>
              {c.scam === "unknown" ? "Pressure detected" : `Named · ${Math.round(c.confidence * 100)}% match`}
            </p>
            <p className="mt-1 text-3xl font-bold" style={{ textWrap: "balance" }}>
              {c.label}
            </p>
            <p className="mt-3 text-lg">{c.rebuttalWarm ?? c.rebuttal}</p>
            <p className="mt-3 text-sm" style={{ color: "var(--ink-soft)" }}>
              {c.stat}{" "}
              <span className="mono text-[11px] uppercase" style={{ color: "var(--muted)" }}>
                · {c.source}
              </span>
            </p>
          </div>
        )}
        {decided && (
          <div className="rounded-md p-4" style={{ background: decided.decision === "veto" ? "var(--safe-tint)" : "var(--surface)" }}>
            <p className="mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              Safety circle · {user.guardianName}
            </p>
            <p className="mt-1 text-lg font-semibold">{decided.decision === "veto" ? "Stopped it. Money untouched." : decided.decision === "approve" ? "Let it through." : "Deciding..."}</p>
          </div>
        )}
        {!c && !payment.interview?.answer && !decided && (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            When a payment is held, her answer and the scam it matches appear here.
          </p>
        )}
      </section>
    </div>
  );
}

function TraceTab({ state, act, now }: { state: State; act: Act; now: number }) {
  const { trace } = state;
  const remaining = trace.startedAt ? trace.goldenHourMs - (now - trace.startedAt) : trace.goldenHourMs;
  const elapsed = trace.startedAt ? now - trace.startedAt : 0;
  const byHop = useMemo(() => {
    const m = new Map<number, TraceNode[]>();
    for (const n of trace.nodes) if (n.revealed && n.hop > 0) m.set(n.hop, [...(m.get(n.hop) ?? []), n]);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [trace.nodes]);
  const label = (id: string | null) => trace.nodes.find((n) => n.id === id)?.label ?? "";

  if (!trace.active)
    return (
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        The tree appears when Beat 4 starts.
      </p>
    );

  return (
    <div className="space-y-8">
      <div className="grid gap-px lg:grid-cols-4" style={{ background: "var(--hairline)" }}>
        <Stat label="Golden hour remaining" value={mmss(remaining)} tone={remaining < 15 * 60 * 1000 ? "critical" : "accent"} />
        <Stat label="Since the money left" value={mmss(elapsed)} />
        <Stat label="Stolen" value={inr(trace.amount)} />
        <Stat label="Recoverable now" value={inr(trace.recovered)} tone="safe" sub={`${Math.round((trace.recovered / trace.amount) * 100)}% · ${trace.holds.length} holds`} />
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(1, byHop.length)}, minmax(0, 1fr))` }}>
        {byHop.map(([hop, nodes]) => (
          <div key={hop}>
            <p className="mono mb-2 text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              Hop {hop} · {nodes.length} account{nodes.length > 1 ? "s" : ""}
            </p>
            <ul className="space-y-2">
              {nodes.map((n) => (
                <li key={n.id} className="rounded-md p-3 text-sm" style={{ background: "var(--surface)", borderLeft: `3px solid ${n.held > 0 ? "var(--critical)" : n.kind === "cashout" ? "var(--muted)" : n.kind === "merchant" || n.kind === "individual" ? "var(--safe)" : "var(--hairline)"}` }}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{n.label}</span>
                    <Tag tone={n.kind === "scammer" || n.kind === "mule" ? "critical" : n.kind === "cashout" ? "muted" : "safe"}>{n.kind}</Tag>
                  </div>
                  <p className="mono text-[11px]" style={{ color: "var(--muted)" }}>
                    from {label(n.parentId)} · got {inr(n.received)}
                  </p>
                  <div className="mt-1 flex justify-between">
                    <span style={{ color: n.held ? "var(--critical)" : "var(--muted)" }}>held {inr2(n.held)}</span>
                    {n.kind !== "cashout" ? <span style={{ color: "var(--safe)" }}>free {inr(n.balanceBefore + n.received - n.forwarded - n.held)}</span> : <span style={{ color: "var(--muted)" }}>left the system</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Btn kind="quiet" onClick={() => act("trace.advance")} disabled={trace.revealedHops >= trace.maxHop}>
          <span style={{ color: "var(--ink)" }}>Reveal next hop</span>
        </Btn>
        <Btn kind="safe" onClick={() => act("incident.confirm")} disabled={trace.confirmed || trace.holds.length === 0}>
          {trace.confirmed ? "Incident confirmed" : "Confirm incident (human in the loop)"}
        </Btn>
        <span className="text-sm" style={{ color: "var(--muted)" }}>
          Proportional Freeze: the ₹20 in Murugan&apos;s tea stall is held; his ₹2 lakh is not. Ravi&apos;s ₹10 is below the floor and never touched.
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value, tone, sub }: { label: string; value: string; tone?: "accent" | "safe" | "critical"; sub?: string }) {
  const color = tone === "safe" ? "var(--safe)" : tone === "critical" ? "var(--critical)" : tone === "accent" ? "var(--accent)" : "var(--ink)";
  return (
    <div className="p-5" style={{ background: "var(--surface)" }}>
      <p className="mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
        {label}
      </p>
      <p className="mono mt-1 text-4xl font-bold" style={{ color }}>
        {value}
      </p>
      {sub && (
        <p className="mono mt-1 text-xs" style={{ color: "var(--muted)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function NetworkTab({ state, now }: { state: State; now: number }) {
  const { network, evidence, user } = state;
  return (
    <div className="space-y-8">
      {network.campaign && (
        <div className="rounded-md p-5" style={{ background: "var(--crit-tint)", borderLeft: "4px solid var(--critical)" }}>
          <p className="mono text-[11px] uppercase tracking-wider" style={{ color: "var(--critical)" }}>
            Campaign detected · {network.campaign.region}
          </p>
          <p className="mt-1 text-2xl font-bold">
            {network.campaign.label}: {network.campaign.count} matching calls in the last {network.campaign.windowMinutes} minutes
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
            Every user&apos;s thresholds moved {network.campaign.thresholdBoost} points for the duration. Same script, many phones: an outbreak, not a coincidence.
          </p>
        </div>
      )}
      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <p className="mono mb-2 text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Immune accounts · {network.immune.length}
          </p>
          <ul className="grid gap-px" style={{ background: "var(--hairline)" }}>
            {network.immune.map((e) => (
              <li key={e.vpa} className="flex items-baseline justify-between px-3 py-2 text-sm" style={{ background: "var(--surface)" }}>
                <span className="mono">{e.vpa}</span>
                <span className="mono text-xs" style={{ color: "var(--muted)" }}>
                  reported {minutesAgo(e.reportedAt, now)}
                </span>
              </li>
            ))}
            {network.immune.length === 0 && (
              <li className="px-3 py-2 text-sm" style={{ background: "var(--surface)", color: "var(--muted)" }}>
                Nothing yet. Confirming an incident publishes its accounts here for everyone.
              </li>
            )}
          </ul>
          <p className="mono mb-2 mt-6 text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Script signatures
          </p>
          <ul className="grid gap-px" style={{ background: "var(--hairline)" }}>
            {network.signatures.map((s) => (
              <li key={s.fingerprint} className="flex items-baseline justify-between px-3 py-2 text-sm" style={{ background: "var(--surface)" }}>
                <span className="mono">{s.fingerprint}</span>
                <span className="mono text-xs" style={{ color: "var(--muted)" }}>
                  {s.scam} · {s.count}×
                </span>
              </li>
            ))}
          </ul>
          {Object.keys(network.reputation).length > 0 && (
            <>
              <p className="mono mb-2 mt-6 text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                Caller reputation
              </p>
              <ul className="grid gap-px" style={{ background: "var(--hairline)" }}>
                {Object.entries(network.reputation).map(([num, r]) => (
                  <li key={num} className="flex items-baseline justify-between px-3 py-2 text-sm" style={{ background: "var(--surface)" }}>
                    <span className="mono">{num}</span>
                    <Tag tone="critical">
                      flagged · {r.reports} report{r.reports > 1 ? "s" : ""}
                    </Tag>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section>
          <div className="flex items-baseline justify-between">
            <p className="mono mb-2 text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              Evidence pack
            </p>
            <Simulated />
          </div>
          {evidence ? (
            <div className="space-y-3 rounded-md p-4 text-sm" style={{ background: "var(--surface)" }}>
              <p>
                <span className="mono">{evidence.incidentId}</span> · {evidence.scam} · victim {evidence.victim.name} ({evidence.victim.vpa}) · {inr(evidence.amount)} stolen, {inr(evidence.recovered)} recoverable
              </p>
              <Row k="NCRP" v={`${evidence.ncrp.portal} · helpline ${evidence.ncrp.helpline} · ${evidence.ncrp.category} · ${evidence.ncrp.status}`} />
              <Row k="CFCFRMS" v={`hold request to beneficiary bank for ${evidence.cfcfrms.beneficiaryVpa} · ${evidence.cfcfrms.status}`} />
              <Row k="STR" v={`${evidence.str.reportingEntity} → ${evidence.str.to} · ${evidence.str.grounds} · ${evidence.str.status}`} />
              {evidence.exchangeHold && <Row k="VASP" v={`${inr(evidence.exchangeHold.amount)} reached a crypto P2P off-ramp · ${evidence.exchangeHold.exchange} · ${evidence.exchangeHold.status}`} />}
              <p className="mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                Holds
              </p>
              <ul className="space-y-1">
                {evidence.holds.map((h) => (
                  <li key={h.vpa} className="flex justify-between">
                    <span>
                      {h.label}{" "}
                      <span className="mono text-xs" style={{ color: "var(--muted)" }}>
                        {h.vpa}
                      </span>
                    </span>
                    <span className="mono" style={{ color: "var(--critical)" }}>
                      {inr2(h.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Generated the moment a human confirms the incident. Never filed automatically.
            </p>
          )}
          <p className="mt-6 text-sm" style={{ color: "var(--muted)" }}>
            {user.name}&apos;s personal threshold shift: <span className="mono">{user.thresholdShift}</span> (set by rehearsals; negative means TRACE steps in earlier for her).
          </p>
        </section>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <p>
      <span className="mono mr-2 text-[11px] uppercase tracking-wider" style={{ color: "var(--accent)" }}>
        {k}
      </span>
      {v}
    </p>
  );
}

function CardTab({ state, act }: { state: State; act: Act }) {
  const { card } = state;
  const m = CARD_MODEL.metrics;
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const seen = card.stats.tp + card.stats.fp + card.stats.fn + card.stats.tn;
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Card-fraud engine · scoring held-out transactions in the app runtime</h2>
          <p className="mono mt-1 text-xs" style={{ color: "var(--muted)" }}>
            {CARD_MODEL.algorithm} · {CARD_MODEL.dataset} · trained {CARD_MODEL.trained_at.slice(0, 10)} · {CARD_MODEL.rows_test.toLocaleString("en-IN")} test rows never seen in training
          </p>
        </div>
        <Btn kind={card.running ? "danger" : "safe"} onClick={() => act(card.running ? "card.stop" : "card.start")}>
          {card.running ? "Pause stream" : "Stream transactions"}
        </Btn>
      </div>

      <div className="grid gap-px lg:grid-cols-5" style={{ background: "var(--hairline)" }}>
        <Stat label="Held-out ROC-AUC" value={m.roc_auc.toFixed(3)} tone="safe" />
        <Stat label="PR-AUC" value={m.pr_auc.toFixed(3)} tone="safe" />
        <Stat label="Recall (fraud caught)" value={pct(m.recall)} tone="accent" sub={`threshold ${m.threshold.toFixed(2)}`} />
        <Stat label="Precision" value={pct(m.precision)} sub={`F1 ${m.f1.toFixed(3)}`} />
        <Stat label="This stream" value={`${card.stats.tp + card.stats.tn}/${seen || 0}`} sub={`TP ${card.stats.tp} · FP ${card.stats.fp} · FN ${card.stats.fn} · TN ${card.stats.tn}`} />
      </div>

      <ul className="grid gap-px" style={{ background: "var(--hairline)" }}>
        {card.feed.map((t) => (
          <li key={t.id} className="grid items-center gap-4 px-4 py-3 lg:grid-cols-[110px_120px_1fr_180px_70px]" style={{ background: "var(--surface)", borderLeft: `3px solid ${t.flagged ? "var(--critical)" : "var(--safe)"}` }}>
            <span className="mono text-xs">{t.tx.type}</span>
            <span className="mono font-semibold">{inr(t.tx.amount)}</span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              sender {inr(t.tx.oldbalanceOrg)} → {inr(t.tx.newbalanceOrig)} · receiver {t.tx.nameDest.startsWith("M") ? "merchant" : "person"} {inr(t.tx.oldbalanceDest)} → {inr(t.tx.newbalanceDest)}
              {t.flagged && t.reasons.length > 0 && <span style={{ color: "var(--critical)" }}> · {t.reasons.join("; ")}</span>}
            </span>
            <span className="flex items-center gap-2">
              <span className="w-full">
                <Bar value={t.prob} max={1} tone={t.flagged ? "critical" : "safe"} />
              </span>
              <span className="mono text-xs">{t.prob.toFixed(2)}</span>
            </span>
            <Tag tone={t.verdict === "TP" || t.verdict === "TN" ? "safe" : "critical"}>{t.verdict}</Tag>
          </li>
        ))}
        {card.feed.length === 0 && (
          <li className="px-4 py-3 text-sm" style={{ background: "var(--surface)", color: "var(--muted)" }}>
            Press Stream (or Beat 6) to score transactions.
          </li>
        )}
      </ul>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        TP: fraud caught · FP: legitimate payment held for a question · FN: fraud missed · TN: legitimate payment untouched. Python trained the trees once; TypeScript walks them here, offline.
      </p>
    </div>
  );
}
