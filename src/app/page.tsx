"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePoll } from "@/lib/client";
import { kindsPresent, MARKER_LABEL } from "@/lib/screening";
import type { MarkerKind } from "@/lib/types";
import { Bar, LiveBadge, Reconnecting } from "@/components/ui";

const ORDER: MarkerKind[] = ["authority", "threat", "isolation", "demand", "blocking"];

/**
 * The laptop screen. Open http://<laptop-ip>:3000 and leave it here.
 * The phone app sends each line of the call; the analysis appears within milliseconds.
 */
export default function Home() {
  const { state, connected, transport, clients } = usePoll();

  // the page is dark but <body> is not, so over-scroll would show a light band
  useEffect(() => {
    document.documentElement.style.background = "#0C1316";
    document.body.style.background = "#0C1316";
    return () => {
      document.documentElement.style.background = "";
      document.body.style.background = "";
    };
  }, []);

  if (!state) {
    return (
      <main className="stage-dark min-h-screen p-10" style={{ background: "var(--ground)", color: "var(--ink)" }}>
        Connecting...
      </main>
    );
  }

  const { call } = state;
  const present = kindsPresent(call.markers);
  const live = call.transcript.length > 0;
  const c = call.classification;
  const danger = call.risk >= 45;

  return (
    <main className="stage-dark min-h-screen" style={{ background: "var(--ground)", color: "var(--ink)" }}>
      <Reconnecting connected={connected} />

      <header className="flex flex-wrap items-center justify-between gap-4 px-8 py-5" style={{ borderBottom: "1px solid var(--hairline)" }}>
        <div className="flex items-baseline gap-4">
          <span className="text-3xl font-bold tracking-tight">
            TR<span style={{ color: "var(--accent)" }}>A</span>CE
          </span>
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            Banks check whether the payment is correct. TRACE checks whether the person is free.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <LiveBadge transport={transport} clients={clients} />
          <Link href="/lab" className="rounded-md px-3 py-1.5 text-sm font-semibold" style={{ background: "var(--accent)", color: "#0c1316" }}>
            Investigation console
          </Link>
        </div>
      </header>

      {!live ? (
        <section className="mx-auto max-w-3xl px-8 py-24 text-center">
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            Waiting for the phone
          </p>
          <p className="mt-4 text-3xl font-bold" style={{ textWrap: "balance" }}>
            Answer a call on the phone, then press Send in TRACE Guard.
          </p>
          <p className="mt-6 text-lg" style={{ color: "var(--ink-soft)" }}>
            The words will appear here as the app sends them, and the scam will be named while the call is still going.
          </p>
          <div className="mx-auto mt-10 inline-block rounded-md px-6 py-4 text-left" style={{ background: "var(--surface)" }}>
            <p className="mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              Put this address in the app
            </p>
            <p className="mono mt-1 text-2xl font-bold" style={{ color: "var(--accent)" }}>
              http://172.16.135.118:3000
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              The phone must be on the same wifi as this laptop.
            </p>
          </div>
        </section>
      ) : (
        <section className="grid gap-8 p-8 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-semibold">{call.active ? "Live call" : "Call ended"}</h2>
              <span className="mono text-xs" style={{ color: "var(--muted)" }}>
                {call.callerName}
              </span>
            </div>
            <ol className="mt-4 space-y-3">
              {call.transcript.map((l, i) => {
                const hits = call.markers.filter((m) => m.lineIndex === i);
                return (
                  <li
                    key={i}
                    className="rounded-md p-4 text-xl"
                    style={{
                      background: "var(--surface)",
                      borderLeft: hits.length ? "4px solid var(--critical)" : "4px solid transparent",
                    }}
                  >
                    {l.text}
                    {hits.length > 0 && (
                      <span className="mono mt-2 block text-[11px] uppercase tracking-wider" style={{ color: "var(--critical)" }}>
                        {Array.from(new Set(hits.map((h) => h.kind))).join(" · ")}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>

          <aside className="space-y-6">
            <div>
              <div className="flex items-baseline justify-between">
                <p className="mono text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  Risk on this call
                </p>
                <span className="mono text-5xl font-bold" style={{ color: danger ? "var(--critical)" : "var(--accent)" }}>
                  {call.risk}
                </span>
              </div>
              <Bar value={call.risk} max={100} tone={danger ? "critical" : "accent"} />
            </div>

            <div>
              <p className="mono mb-2 text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                Detected by the words, not the voice
              </p>
              <ul className="grid gap-px" style={{ background: "var(--hairline)" }}>
                {ORDER.map((k) => {
                  const on = present.includes(k);
                  const strong = k === "isolation" || k === "blocking";
                  return (
                    <li
                      key={k}
                      className="lamp px-4 py-3"
                      style={{
                        background: on ? (strong ? "var(--crit-tint)" : "var(--accent-tint)") : "var(--surface)",
                        color: on ? (strong ? "var(--critical)" : "var(--accent)") : "var(--muted)",
                      }}
                    >
                      <span className="font-semibold">{MARKER_LABEL[k]}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {call.attestationLine && (
              <div className="rounded-md p-4" style={{ background: call.attested ? "var(--safe-tint)" : "var(--crit-tint)", color: call.attested ? "var(--safe)" : "var(--critical)" }}>
                <p className="mono text-[11px] uppercase tracking-wider">Caller attestation</p>
                <p className="mt-1 font-semibold">{call.attestationLine}</p>
              </div>
            )}

            {danger && c && (
              <div className="rounded-md p-5" style={{ background: "var(--crit-tint)", borderLeft: "4px solid var(--critical)" }}>
                <p className="mono text-[11px] uppercase tracking-wider" style={{ color: "var(--critical)" }}>
                  Recognised
                </p>
                <p className="mt-1 text-3xl font-bold" style={{ textWrap: "balance" }}>
                  {c.label}
                </p>
                <p className="mt-3 text-lg">{c.rebuttalWarm ?? c.rebuttal}</p>
                <p className="mt-3 text-sm" style={{ color: "var(--ink-soft)" }}>
                  {c.stat}
                </p>
              </div>
            )}
          </aside>
        </section>
      )}

      <footer className="mono px-8 pb-6 text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
        Every bank, NPCI, police and FIU rail in this prototype is simulated ·{" "}
        <Link href="/presenter" className="underline">presenter</Link> ·{" "}
        <Link href="/stage" className="underline">stage</Link> ·{" "}
        <Link href="/phone" className="underline">phone</Link> ·{" "}
        <Link href="/guardian" className="underline">guardian</Link>
      </footer>
    </main>
  );
}
