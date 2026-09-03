import type { Campaign, ImmuneEntry, Reputation, ScriptSignature, State } from "./types";

export const CAMPAIGN_WINDOW_MIN = 40;
export const CAMPAIGN_MIN_COUNT = 100;
export const CAMPAIGN_BOOST = -10;

type Network = State["network"];

export function isImmune(network: Network, vpa: string): ImmuneEntry | null {
  return network.immune.find((e) => e.vpa.toLowerCase() === vpa.toLowerCase()) ?? null;
}

export function publishImmunity(network: Network, vpas: string[], incidentId: string, now: number): Network {
  const seen = new Set<string>();
  const fresh: ImmuneEntry[] = [];
  for (const vpa of vpas) {
    const k = vpa.toLowerCase();
    if (!vpa || vpa === "cash" || vpa === "p2p" || seen.has(k) || isImmune(network, vpa)) continue;
    seen.add(k);
    fresh.push({ vpa, reportedAt: now, incidentId, simulated: true });
  }
  return { ...network, immune: [...network.immune, ...fresh] };
}

export function recordSignature(network: Network, fingerprint: string, scam: string, now: number): Network {
  const existing = network.signatures.find((s) => s.fingerprint === fingerprint);
  const signatures: ScriptSignature[] = existing
    ? network.signatures.map((s) => (s.fingerprint === fingerprint ? { ...s, count: s.count + 1 } : s))
    : [...network.signatures, { fingerprint, scam, firstSeen: now, count: 1 }];
  return { ...network, signatures };
}

export function recordReputation(network: Network, callerId: string, now: number): Network {
  const prev: Reputation = network.reputation[callerId] ?? { reports: 0, lastSeen: now, flagged: false };
  const rep: Reputation = { reports: prev.reports + 1, lastSeen: now, flagged: true };
  return { ...network, reputation: { ...network.reputation, [callerId]: rep } };
}

/** An outbreak: the same script fingerprint hitting many users inside the window. */
export function detectCampaign(network: Network, label: string, region = "Tamil Nadu"): Campaign | null {
  const hot = [...network.signatures].sort((a, b) => b.count - a.count)[0];
  if (!hot || hot.count < CAMPAIGN_MIN_COUNT) return null;
  return {
    fingerprint: hot.fingerprint,
    scam: hot.scam,
    label,
    count: hot.count,
    windowMinutes: CAMPAIGN_WINDOW_MIN,
    region,
    thresholdBoost: CAMPAIGN_BOOST,
  };
}

export function minutesAgo(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s} seconds ago`;
  const m = Math.round(s / 60);
  return m === 1 ? "1 minute ago" : `${m} minutes ago`;
}
