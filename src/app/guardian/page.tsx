"use client";

import { inr, useAct, usePoll } from "@/lib/client";
import { Btn, LiveBadge, MarkerLamps, Reconnecting, Simulated, Tag, TierPill } from "@/components/ui";

export default function GuardianPage() {
  const { state, connected, transport } = usePoll();
  const { act, error } = useAct("guardian");

  if (!state) return <div className="p-6 text-sm">Opening...</div>;
  const { guardian, user, call } = state;
  const open = guardian.requests.find((r) => !r.decision);
  const last = [...guardian.requests].reverse()[0];

  return (
    <div className="min-h-screen" style={{ background: "var(--surface-2)" }}>
      <div className="mx-auto min-h-screen max-w-[420px]" style={{ background: "var(--surface)", borderLeft: "1px solid var(--hairline)", borderRight: "1px solid var(--hairline)" }}>
        <Reconnecting connected={connected} />
        <header className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--hairline)" }}>
          <div className="flex items-baseline gap-2">
            <span className="font-bold">{user.guardianName}</span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              TRACE safety circle for {user.name}
            </span>
          </div>
          <LiveBadge transport={transport} />
        </header>
        {error && (
          <div className="px-4 py-2 text-sm" style={{ background: "var(--crit-tint)", color: "var(--critical)" }}>
            {error}
          </div>
        )}

        <main className="space-y-4 p-4">
          {guardian.joinedCall && (
            <section className="rounded-lg p-4" style={{ background: "var(--ink)", color: "var(--ground)" }}>
              <p className="mono text-[10px] uppercase tracking-wider opacity-70">On the call</p>
              <p className="mt-1 text-lg font-semibold">You are on the call with Amma.</p>
              <p className="mt-1 text-sm opacity-80">{call.ended === "scammer_hangup" ? "The caller hung up the moment you joined." : "Stay on."}</p>
            </section>
          )}

          {open ? (
            <section className="space-y-4">
              {open.duress && (
                <div className="rounded-md p-3 font-semibold" style={{ background: "var(--crit-tint)", color: "var(--critical)" }}>
                  Amma used her safety PIN. She may be with someone who is pressuring her.
                </div>
              )}
              <div className="rounded-lg p-4" style={{ background: "var(--surface-2)" }}>
                <p className="mono text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  {user.name} wants to pay
                </p>
                <p className="mt-1 text-3xl font-bold">{inr(open.amount)}</p>
                <p className="mt-1">
                  to <strong>{open.payee.name}</strong>{" "}
                  <span className="mono text-xs" style={{ color: "var(--muted)" }}>
                    {open.payee.vpa}
                  </span>
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <TierPill tier={open.tier} score={open.score} />
                  {!open.payee.known && <Tag tone="accent">Never paid before</Tag>}
                </div>
              </div>

              {open.markers.length > 0 && (
                <div>
                  <p className="mono mb-1 text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                    What the caller said
                  </p>
                  <MarkerLamps present={open.markers} compact />
                </div>
              )}

              {open.answer && (
                <blockquote className="rounded-md p-3 italic" style={{ background: "var(--surface-2)" }}>
                  “{open.answer}”
                  <span className="mono mt-1 block text-[10px] not-italic uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                    Amma, in her own words
                  </span>
                </blockquote>
              )}

              {open.classification && open.classification.scam !== "unknown" && (
                <p className="text-sm">
                  TRACE recognised this as the <strong>{open.classification.label}</strong>.
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Btn kind="danger" big onClick={() => act("cosign.decide", { id: open.id, decision: "veto" })}>
                  Stop it
                </Btn>
                <Btn kind="quiet" big onClick={() => act("cosign.decide", { id: open.id, decision: "approve" })}>
                  Let it through
                </Btn>
              </div>
            </section>
          ) : last ? (
            <section className="rounded-lg p-4" style={{ background: last.decision === "veto" ? "var(--safe-tint)" : "var(--surface-2)" }}>
              <p className="mono text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                Last decision
              </p>
              <p className="mt-1 font-semibold">
                {last.decision === "veto" ? "You stopped" : "You approved"} {inr(last.amount)} to {last.payee.name}.
              </p>
            </section>
          ) : (
            <section className="rounded-lg p-6 text-center" style={{ background: "var(--surface-2)" }}>
              <p className="text-lg font-semibold">Nothing needs you.</p>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                You will feel a buzz if Amma is ever asked to pay under pressure.
              </p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
