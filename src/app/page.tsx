import Link from "next/link";

const SCREENS = [
  { href: "/presenter", title: "Presenter", who: "You", what: "Beats 1 to 5, reset, live toggles, event log. Keep this on the laptop." },
  { href: "/stage", title: "Stage", who: "Projector", what: "Call screening, coercion panel, golden-hour trace, network immunity." },
  { href: "/phone", title: "Phone", who: "Lakshmi", what: "Her banking app. Open on a phone or a narrow browser window." },
  { href: "/guardian", title: "Guardian", who: "Priya", what: "Her daughter's phone. Approve or veto, join the call." },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <p className="tag inline-block" style={{ color: "var(--muted)" }}>
        Innovation Unbound · Round 2 · PS1
      </p>
      <h1 className="mt-4 text-5xl font-bold tracking-tight">TRACE</h1>
      <p className="mt-3 max-w-xl text-lg" style={{ color: "var(--ink-soft)" }}>
        Banks check whether the payment is correct. <span style={{ color: "var(--accent)" }}>TRACE checks whether the person is free.</span>
      </p>
      <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
        Every bank, NPCI, police and FIU rail in this prototype is simulated. Nothing real moves.
      </p>
      <ul className="mt-10 grid gap-px border" style={{ background: "var(--hairline)", borderColor: "var(--hairline)" }}>
        {SCREENS.map((s) => (
          <li key={s.href} style={{ background: "var(--surface)" }}>
            <Link href={s.href} className="flex items-baseline gap-4 px-5 py-4 hover:underline">
              <span className="mono w-20 shrink-0 text-xs" style={{ color: "var(--accent)" }}>
                {s.who}
              </span>
              <span className="w-28 shrink-0 font-semibold">{s.title}</span>
              <span className="text-sm" style={{ color: "var(--muted)" }}>
                {s.what}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm" style={{ color: "var(--muted)" }}>
        Open all four. Real PIN <span className="mono">4471</span>, duress PIN <span className="mono">9999</span>. Start with Presenter → Reset → Beat 1.
      </p>
    </main>
  );
}
