"use client";

import type { MarkerKind, Tier } from "@/lib/types";
import { MARKER_LABEL } from "@/lib/screening";
import { TIER_LABEL } from "@/lib/coercion";

export function Tag({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "safe" | "critical" | "accent" }) {
  const color = tone === "safe" ? "var(--safe)" : tone === "critical" ? "var(--critical)" : tone === "accent" ? "var(--accent)" : "var(--muted)";
  return (
    <span className="tag" style={{ color }}>
      {children}
    </span>
  );
}

export function Simulated() {
  return <Tag>Simulated</Tag>;
}

export function TierPill({ tier, score }: { tier: Tier; score?: number }) {
  const map: Record<Tier, { bg: string; fg: string }> = {
    allow: { bg: "var(--safe-tint)", fg: "var(--safe)" },
    check: { bg: "var(--surface-2)", fg: "var(--ink-soft)" },
    hold: { bg: "var(--accent-tint)", fg: "var(--accent)" },
    stop: { bg: "var(--crit-tint)", fg: "var(--critical)" },
  };
  const c = map[tier];
  return (
    <span className="mono inline-flex items-center gap-2 rounded-sm px-2 py-1 text-xs font-semibold" style={{ background: c.bg, color: c.fg }}>
      {TIER_LABEL[tier].toUpperCase()}
      {typeof score === "number" && <span>{score}/100</span>}
    </span>
  );
}

export function Btn({
  children,
  onClick,
  kind = "primary",
  disabled,
  big,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  kind?: "primary" | "quiet" | "danger" | "safe";
  disabled?: boolean;
  big?: boolean;
  type?: "button" | "submit";
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: "var(--ink)", color: "var(--ground)" },
    quiet: { background: "transparent", color: "var(--ink)", border: "1px solid var(--hairline)" },
    danger: { background: "var(--critical)", color: "#fff" },
    safe: { background: "var(--safe)", color: "#fff" },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md font-semibold transition-opacity disabled:opacity-40 ${big ? "px-5 py-4 text-lg" : "px-4 py-2.5 text-sm"}`}
      style={styles[kind]}
    >
      {children}
    </button>
  );
}

export function Reconnecting({ connected }: { connected: boolean }) {
  if (connected) return null;
  return (
    <div className="mono px-4 py-2 text-center text-xs" style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>
      Reconnecting to TRACE...
    </div>
  );
}

/** Shows the transport actually in use, so the audience can see this is a pushed connection. */
export function LiveBadge({ transport, clients }: { transport: "live" | "polling" | "offline"; clients?: number }) {
  const map = {
    live: { color: "var(--safe)", bg: "var(--safe-tint)", label: "Live" },
    polling: { color: "var(--accent)", bg: "var(--accent-tint)", label: "Polling" },
    offline: { color: "var(--critical)", bg: "var(--crit-tint)", label: "Offline" },
  } as const;
  const c = map[transport];
  return (
    <span className="mono inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[10px] uppercase tracking-wider" style={{ background: c.bg, color: c.color }}>
      <span className={transport === "live" ? "animate-pulse" : ""} style={{ display: "inline-block", width: 6, height: 6, borderRadius: 999, background: c.color }} />
      {c.label}
      {transport === "live" && typeof clients === "number" && clients > 0 && <span>· {clients} device{clients === 1 ? "" : "s"}</span>}
    </span>
  );
}

const ORDER: MarkerKind[] = ["authority", "threat", "isolation", "demand", "blocking"];

export function MarkerLamps({ present, compact }: { present: MarkerKind[]; compact?: boolean }) {
  return (
    <ul className={`grid gap-px ${compact ? "grid-cols-5" : ""}`} style={{ background: "var(--hairline)" }}>
      {ORDER.map((k) => {
        const on = present.includes(k);
        const strong = k === "isolation" || k === "blocking";
        return (
          <li
            key={k}
            className={`lamp px-3 ${compact ? "py-2 text-center" : "py-3"}`}
            style={{
              background: on ? (strong ? "var(--crit-tint)" : "var(--accent-tint)") : "var(--surface)",
              color: on ? (strong ? "var(--critical)" : "var(--accent)") : "var(--muted)",
            }}
          >
            <span className="mono block text-[10px] uppercase tracking-wider">{k}</span>
            {!compact && <span className="block text-sm font-semibold">{MARKER_LABEL[k]}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export function Bar({ value, max, tone = "accent" }: { value: number; max: number; tone?: "accent" | "safe" | "critical" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = tone === "safe" ? "var(--safe)" : tone === "critical" ? "var(--critical)" : "var(--accent)";
  return (
    <div className="h-2 w-full overflow-hidden rounded-sm" style={{ background: "var(--surface-2)" }}>
      <div className="lamp h-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
