/**
 * Pure, deterministic, offline scam-family classifier. No React, no I/O, no
 * ML, no network. Given a transcript (and the markers already fired), names
 * the closest-matching scam family from a fixed catalogue of >= 8 families
 * and returns a short, clearly-illustrative awareness-style statistic — not
 * a claim of a real, sourced academic citation.
 */
import type { MarkerId, ScamFamily, TaxonomyResult, TranscriptLine } from "./types";

interface ScamFamilyDefinition extends ScamFamily {
  keywords: readonly RegExp[];
  /** Markers whose presence nudges classification toward this family when
   * keyword evidence is otherwise tied. */
  supportingMarkers: readonly MarkerId[];
}

/** >= 8 scam families, each with a short, plausible awareness-campaign-style
 * statistic. These are illustrative figures used in public-safety messaging,
 * not a real, verifiable citation — presented that way on screen. */
const SCAM_FAMILIES: readonly ScamFamilyDefinition[] = [
  {
    id: "digital_arrest",
    label: "digital arrest",
    statistic:
      "Awareness campaigns cite roughly 6 in 10 'digital arrest' calls impersonating police, CBI or narcotics officers (illustrative figure, not a verified citation).",
    keywords: [
      /\bdigital arrest\b/i,
      /\bcbi\b/i,
      /\bnarcotics\b/i,
      /\barrest warrant\b/i,
      /\bvideo call\b/i,
      /\bdon'?t disconnect\b/i,
      /\bmoney laundering\b/i,
    ],
    supportingMarkers: ["isolation", "threat", "authority"],
  },
  {
    id: "courier_scam",
    label: "courier scam",
    statistic:
      "Consumer-protection material estimates a large share of courier-fraud calls invent a parcel containing drugs or a passport to force a payment (illustrative figure, not a verified citation).",
    keywords: [
      /\bcourier\b/i,
      /\bparcel\b/i,
      /\bfedex\b/i,
      /\bpackage\b/i,
      /\bcustoms duty\b/i,
      /\billegal item\b/i,
    ],
    supportingMarkers: ["authority", "threat"],
  },
  {
    id: "bank_fraud_alert",
    label: "bank fraud alert",
    statistic:
      "Banking-fraud awareness material notes that no bank ever asks for a full OTP or PIN over a call (illustrative framing, not a verified citation).",
    keywords: [
      /\bkyc\b/i,
      /\bdebit card\b/i,
      /\bcredit card\b/i,
      /\baccount\s+(will\s+be\s+)?block(ed)?\b/i,
      /\bupdate\s+your\s+bank\b/i,
    ],
    supportingMarkers: ["demand", "authority", "blocking"],
  },
  {
    id: "electricity_disconnection",
    label: "electricity disconnection",
    statistic:
      "Utility-fraud advisories describe same-day disconnection threats as a common pressure tactic in electricity-board impersonation calls (illustrative figure, not a verified citation).",
    keywords: [
      /\belectricity\b/i,
      /\bpower\s+(will\s+be\s+)?disconnect(ed)?\b/i,
      /\belectricity board\b/i,
      /\bbill\s+(unpaid|pending)\b/i,
    ],
    supportingMarkers: ["authority", "threat"],
  },
  {
    id: "tech_support_scam",
    label: "tech support scam",
    statistic:
      "Cybersecurity awareness material warns that remote-access requests from an unsolicited 'support' call are a leading tech-support-scam indicator (illustrative figure, not a verified citation).",
    keywords: [
      /\banydesk\b/i,
      /\bteamviewer\b/i,
      /\bremote access\b/i,
      /\bvirus\b/i,
      /\bcomputer has a virus\b/i,
      /\bmicrosoft support\b/i,
      /\btech support\b/i,
    ],
    supportingMarkers: ["demand"],
  },
  {
    id: "lottery_prize_scam",
    label: "lottery/prize scam",
    statistic:
      "Fraud-awareness campaigns note that a genuine lottery never asks the winner to pay a 'processing fee' up front (illustrative framing, not a verified citation).",
    keywords: [
      /\blottery\b/i,
      /\bprize\b/i,
      /\byou\s+(have\s+)?won\b/i,
      /\bclaim\s+your\s+prize\b/i,
      /\bprocessing fee\b/i,
      /\bkbc\b/i,
    ],
    supportingMarkers: ["demand"],
  },
  {
    id: "investment_scam",
    label: "investment scam",
    statistic:
      "Securities-regulator advisories flag 'guaranteed returns' language as present in the large majority of investment-fraud pitches (illustrative figure, not a verified citation).",
    keywords: [
      /\bguaranteed returns?\b/i,
      /\bdouble your money\b/i,
      /\btrading tips?\b/i,
      /\bstock tips?\b/i,
      /\bcrypto\b/i,
      /\binvestment\s+opportunity\b/i,
    ],
    supportingMarkers: ["demand"],
  },
  {
    id: "loan_app_scam",
    label: "loan app scam",
    statistic:
      "Consumer-finance advisories describe instant-approval loan apps that harvest contacts for harassment as a recurring complaint pattern (illustrative figure, not a verified citation).",
    keywords: [
      /\binstant loan\b/i,
      /\bloan\s+app\b/i,
      /\bloan\s+(is\s+)?approved\b/i,
      /\bprocessing fee\b/i,
      /\baccess\s+your\s+contacts\b/i,
    ],
    supportingMarkers: ["demand", "threat"],
  },
  {
    id: "sextortion",
    label: "sextortion",
    statistic:
      "Victim-support advisories note that paying a sextortion demand does not reliably stop further threats in most reported cases (illustrative framing, not a verified citation).",
    keywords: [
      /\brecorded\b/i,
      /\bcompromising\b/i,
      /\bnude\b/i,
      /\bshare the video\b/i,
      /\bsend it to your contacts\b/i,
      /\bscreen\s?record(ed|ing)?\b/i,
    ],
    supportingMarkers: ["threat", "demand"],
  },
  {
    id: "job_scam",
    label: "job scam",
    statistic:
      "Labour-fraud advisories flag an upfront 'registration fee' for a work-from-home job as a common red flag (illustrative figure, not a verified citation).",
    keywords: [
      /\bwork from home\b/i,
      /\bpart time job\b/i,
      /\bjob offer\b/i,
      /\bregistration fee\b/i,
      /\btask based earning\b/i,
    ],
    supportingMarkers: ["demand"],
  },
];

/** The full catalogue, for UI reference (e.g. listing all families). */
export const ALL_SCAM_FAMILIES: readonly ScamFamily[] = SCAM_FAMILIES.map(
  ({ id, label, statistic }) => ({ id, label, statistic }),
);

function scoreFamily(
  fullText: string,
  markers: readonly MarkerId[],
  family: ScamFamilyDefinition,
): number {
  const keywordHits = family.keywords.reduce(
    (count, pattern) => (pattern.test(fullText) ? count + 1 : count),
    0,
  );
  if (keywordHits === 0) return 0;
  const markerBonus = family.supportingMarkers.reduce(
    (count, markerId) => (markers.includes(markerId) ? count + 1 : count),
    0,
  );
  return keywordHits * 10 + markerBonus;
}

/**
 * Name the scam family a transcript most closely matches, deterministically
 * and offline. Returns `{ scamType: null, ... }` when no family has any
 * keyword evidence — taxonomy never guesses on an empty/garbage transcript.
 */
export function classifyScam(
  transcript: readonly TranscriptLine[],
  markers: readonly MarkerId[],
): TaxonomyResult {
  const fullText = transcript.map((line) => line.text).join(" \n ");
  if (fullText.trim().length === 0) {
    return { scamType: null, label: null, statistic: null };
  }

  let best: ScamFamilyDefinition | null = null;
  let bestScore = 0;

  for (const family of SCAM_FAMILIES) {
    const score = scoreFamily(fullText, markers, family);
    if (score > bestScore) {
      bestScore = score;
      best = family;
    }
  }

  if (!best) {
    return { scamType: null, label: null, statistic: null };
  }

  return { scamType: best.id, label: best.label, statistic: best.statistic };
}
