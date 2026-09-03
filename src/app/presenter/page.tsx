"use client";

import Link from "next/link";
import { inr, useAct, usePoll } from "@/lib/client";
import { Btn, LiveBadge, Reconnecting, Tag, TierPill } from "@/components/ui";

const BEATS = [
  { n: 1, title: "Ordinary payment", hint: "Phone: tap Kumar Stores, type 340, PIN 4471. Nothing fires." },
  { n: 2, title: "The scam call", hint: "Stage plays the call. Point at the markers, then the attestation line. Phone can add Priya to the call." },
  { n: 3, title: "The coached payment", hint: "Phone: type 50000 slowly with pauses. Interview → let a judge speak → named. Guardian vetoes. (Or PIN 9999.)" },
  { n: 4, title: "The money already left", hint: "Stage: clock runs, tree reveals every 3 s, holds land. Then Confirm incident." },
  { n: 5, title: "Immunity", hint: "Phone: type any amount, Continue. Blocked before it starts. Stage: network + campaign." },
  { n: 6, title: "Card fraud", hint: "Stage: XGBoost trees trained on PaySim score held-out transactions live. Phone shows a held card payment." },
];

export default function PresenterPage() {
  const { state, connected, transport, clients } = usePoll();
  const { act, error } = useAct("presenter");
  if (!state) return <div className="p-6">Connecting...</div>;
  const { beat, call, device, payment, trace, network, rehearsal } = state;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <Reconnecting connected={connected} />
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold">
            TRACE · presenter
            <LiveBadge transport={transport} clients={clients} />
          </h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Open{" "}
            <Link href="/stage" className="underline">
              /stage
            </Link>{" "}
            on the projector,{" "}
            <Link href="/phone" className="underline">
              /phone
            </Link>{" "}
            and{" "}
            <Link href="/guardian" className="underline">
              /guardian
            </Link>{" "}
            on two phones (or narrow windows).
          </p>
        </div>
        <Btn kind="danger" onClick={() => act("demo.reset")}>
          Reset everything
        </Btn>
      </header>
      {error && (
        <p className="mt-3 rounded-md px-3 py-2 text-sm" style={{ background: "var(--crit-tint)", color: "var(--critical)" }}>
          {error}
        </p>
      )}

      <section className="mt-6 grid gap-2 md:grid-cols-6">
        {BEATS.map((b) => (
          <button key={b.n} onClick={() => act("demo.beat", { beat: b.n })} className="rounded-md p-4 text-left" style={{ background: beat === b.n ? "var(--ink)" : "var(--surface)", color: beat === b.n ? "var(--ground)" : "var(--ink)", border: "1px solid var(--hairline)" }}>
            <span className="mono text-[11px] uppercase tracking-wider opacity-70">Beat {b.n}</span>
            <span className="mt-1 block font-semibold">{b.title}</span>
            <span className="mt-2 block text-xs opacity-80">{b.hint}</span>
          </button>
        ))}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <p className="mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Live controls
          </p>
          <div className="flex flex-wrap gap-2">
            <Btn kind="quiet" onClick={() => act("call.start", { scenario: "digital_arrest" })} disabled={call.active}>
              Start scam call
            </Btn>
            <Btn kind="quiet" onClick={() => act("call.start", { scenario: "attested_bank" })} disabled={call.active}>
              Start attested bank call
            </Btn>
            <Btn kind="quiet" onClick={() => act("call.advance")} disabled={!call.active}>
              Next line
            </Btn>
            <Btn kind="quiet" onClick={() => act("call.stop")} disabled={!call.active}>
              Stop call
            </Btn>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn kind={device.remoteAccessApp ? "danger" : "quiet"} onClick={() => act("device.remoteApp", { app: device.remoteAccessApp ? null : "AnyDesk" })}>
              {device.remoteAccessApp ? `${device.remoteAccessApp} on · turn off` : "Simulate AnyDesk on the phone"}
            </Btn>
            <Btn kind="quiet" onClick={() => act("device.appSwitch")}>
              +1 app switch ({device.appSwitches})
            </Btn>
            <Btn kind="quiet" onClick={() => act("pay.select", { payeeId: "mule" })}>
              Inject pasted mule payee
            </Btn>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn kind="quiet" onClick={() => act("trace.start", { amount: 50_000 })} disabled={trace.active}>
              Start trace
            </Btn>
            <Btn kind="quiet" onClick={() => act("trace.advance")} disabled={!trace.active || trace.revealedHops >= trace.maxHop}>
              Reveal next hop ({trace.revealedHops}/{trace.maxHop})
            </Btn>
            <Btn kind="safe" onClick={() => act("incident.confirm")} disabled={!trace.active || trace.confirmed || trace.holds.length === 0}>
              Confirm incident
            </Btn>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn kind={state.card.running ? "danger" : "quiet"} onClick={() => act(state.card.running ? "card.stop" : "card.start")}>
              {state.card.running ? "Stop card stream" : "Stream card transactions"}
            </Btn>
            <Btn kind="quiet" onClick={() => act("media.check", { sample: "real_scammer" })} disabled={!call.transcript.length}>
              Audio check: real scammer
            </Btn>
            <Btn kind="quiet" onClick={() => act("media.check", { sample: "cloned_voice" })} disabled={!call.transcript.length}>
              Audio check: cloned voice
            </Btn>
            <Btn kind="quiet" onClick={() => act("agent.start", { trip: "cheap" })}>
              Agent: book ₹1,240 trip
            </Btn>
            <Btn kind="quiet" onClick={() => act("agent.start", { trip: "expensive" })}>
              Agent: book ₹4,600 trip
            </Btn>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn kind="quiet" onClick={() => act("drill.start")} disabled={call.active || rehearsal.active}>
              Run a rehearsal call
            </Btn>
            {(["auto", "call", "coercion", "trace", "network", "card"] as const).map((t) => (
              <Btn key={t} kind={state.stagePin === t ? "primary" : "quiet"} onClick={() => act("stage.pin", { tab: t })}>
                stage: {t}
              </Btn>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Status
          </p>
          <dl className="grid gap-px text-sm" style={{ background: "var(--hairline)" }}>
            <Row k="Call" v={call.active ? `active · risk ${call.risk} · ${call.markers.length} markers · ${call.callerName}` : call.transcript.length ? `ended (${call.ended})` : "none"} />
            <Row k="Device" v={`${device.remoteAccessApp ?? "no remote app"} · ${device.appSwitches} app switches`} />
            <Row
              k="Payment"
              v={
                <span className="flex flex-wrap items-center gap-2">
                  {payment.stage}
                  {payment.payee && ` · ${inr(payment.amount)} to ${payment.payee.name}`}
                  {payment.breakdown.length > 0 && <TierPill tier={payment.tier} score={payment.score} />}
                  {payment.duress && <Tag tone="critical">duress</Tag>}
                </span>
              }
            />
            <Row k="Trace" v={trace.active ? `hop ${trace.revealedHops}/${trace.maxHop} · ${inr(trace.recovered)} recoverable · ${trace.confirmed ? "confirmed" : "not confirmed"}` : "not started"} />
            <Row k="Network" v={`${network.immune.length} immune · ${network.campaign ? `campaign: ${network.campaign.count} calls` : "no campaign"}`} />
            <Row k="Rehearsal" v={rehearsal.active ? "running" : rehearsal.lastResult ? `last: ${rehearsal.lastResult} · shift ${state.user.thresholdShift}` : "none"} />
            <Row k="Card" v={state.card.running ? `streaming · ${state.card.cursor} scored · TP ${state.card.stats.tp} FP ${state.card.stats.fp} FN ${state.card.stats.fn} TN ${state.card.stats.tn}` : state.card.cursor ? `paused · ${state.card.cursor} scored` : "idle"} />
            <Row k="Agent" v={state.agent.trip ? `${state.agent.step} · ${state.agent.trip.label}` : "idle"} />
          </dl>
        </div>
      </section>

      <section className="mt-8">
        <p className="mono mb-2 text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          Event log
        </p>
        <ol className="grid gap-px text-sm" style={{ background: "var(--hairline)" }}>
          {[...state.events]
            .reverse()
            .slice(0, 30)
            .map((e, i) => (
              <li key={i} className="flex gap-3 px-3 py-2" style={{ background: "var(--surface)" }}>
                <span className="mono shrink-0 text-xs" style={{ color: "var(--muted)" }}>
                  {new Date(e.ts).toLocaleTimeString("en-IN", { hour12: false })}
                </span>
                <span className="mono shrink-0 text-xs" style={{ color: "var(--accent)" }}>
                  {e.type}
                </span>
                <span>{e.summary}</span>
              </li>
            ))}
        </ol>
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 px-3 py-2" style={{ background: "var(--surface)" }}>
      <dt className="mono text-xs uppercase tracking-wider" style={{ color: "var(--muted)" }}>
        {k}
      </dt>
      <dd>{v}</dd>
    </div>
  );
}
