import type { Breakdown, Signals, Tier } from "./types";

/** Score 0..100 from signals no transaction-level engine uses. */
export const WEIGHTS = {
  callActive: 25,
  remoteApp: 25,
  newPayee: 12,
  pastedVpa: 10,
  appSwitches: 12,
  hesitationIndex: 16,
} as const;

/** allow < check <= CHECK < hold <= HOLD < stop <= STOP; thresholdShift moves all three together. */
export const THRESHOLDS = { check: 25, hold: 50, stop: 80 } as const;

export function scoreCoercion(s: Signals, thresholdShift = 0): { score: number; breakdown: Breakdown[]; tier: Tier } {
  const switches = Math.max(0, Math.min(3, Math.floor(s.appSwitches)));
  const hes = Math.max(0, Math.min(1, Number.isFinite(s.hesitationIndex) ? s.hesitationIndex : 0));
  const breakdown: Breakdown[] = [
    {
      key: "callActive",
      label: "On a call while paying",
      points: s.callActive ? WEIGHTS.callActive : 0,
      max: WEIGHTS.callActive,
      note: s.callActive ? "Almost no one pays mid-call; almost every victim does" : "No call in progress",
    },
    {
      key: "remoteApp",
      label: "Screen-sharing app present",
      points: s.remoteApp ? WEIGHTS.remoteApp : 0,
      max: WEIGHTS.remoteApp,
      note: s.remoteApp ? `${s.remoteApp} is running` : "No remote-access app",
    },
    {
      key: "newPayee",
      label: "First-time payee",
      points: s.newPayee ? WEIGHTS.newPayee : 0,
      max: WEIGHTS.newPayee,
      note: s.newPayee ? "Never paid before" : "Paid before",
    },
    {
      key: "pastedVpa",
      label: "Payee ID was pasted or dictated",
      points: s.pastedVpa ? WEIGHTS.pastedVpa : 0,
      max: WEIGHTS.pastedVpa,
      note: s.pastedVpa ? "Not chosen from contacts" : "Chosen from contacts",
    },
    {
      key: "appSwitches",
      label: "Switching apps mid-payment",
      points: Math.round((switches / 3) * WEIGHTS.appSwitches),
      max: WEIGHTS.appSwitches,
      note: switches ? `${s.appSwitches} switches (reading instructions?)` : "Stayed in the app",
    },
    {
      key: "hesitationIndex",
      label: "Hesitant typing on the amount",
      points: Math.round(hes * WEIGHTS.hesitationIndex),
      max: WEIGHTS.hesitationIndex,
      note: hes > 0.5 ? "Type, pause, erase, retype" : hes > 0.2 ? "Some hesitation" : "Fluent",
    },
  ];
  const score = Math.min(100, breakdown.reduce((a, b) => a + b.points, 0));
  return { score, breakdown, tier: tierFor(score, thresholdShift) };
}

export function tierFor(score: number, thresholdShift = 0): Tier {
  const t = {
    check: THRESHOLDS.check + thresholdShift,
    hold: THRESHOLDS.hold + thresholdShift,
    stop: THRESHOLDS.stop + thresholdShift,
  };
  if (score >= t.stop) return "stop";
  if (score >= t.hold) return "hold";
  if (score >= t.check) return "check";
  return "allow";
}

export const TIER_LABEL: Record<Tier, string> = {
  allow: "Low",
  check: "Check",
  hold: "Hold",
  stop: "Stop",
};
