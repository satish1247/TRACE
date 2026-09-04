/**
 * Pure, deterministic, offline scorer for the five scam-script markers
 * defined in PRD-1-SHIELD.md. No React, no I/O, no ML, no network — this is
 * the module REQUIREMENTS.md's C4 requires be unit-testable in isolation.
 *
 * Marker 3 (isolation instruction) is the strongest signal in the product:
 * no bank, police officer or company has ever legitimately told a customer
 * to stay on the line and not tell their family.
 */
import type { MarkerId, MarkerScoreResult, TranscriptLine } from "./types";

/** Fixed left-to-right order from the PRD's marker table — used by the UI
 * to render the five lamps in a stable position regardless of fire order. */
export const MARKER_ORDER: readonly MarkerId[] = ["authority", "threat", "isolation", "demand", "blocking"];

export const MARKER_LABELS: Readonly<Record<MarkerId, string>> = {
  authority: "Authority claim",
  threat: "Threat",
  isolation: "Isolation instruction",
  demand: "Payment/credential demand",
  blocking: "Verification blocking",
};

export const MARKER_WEIGHTS: Readonly<Record<MarkerId, number>> = {
  authority: 15,
  threat: 20,
  isolation: 30,
  demand: 20,
  blocking: 25,
};

/** Points added for every hit after the first on the same marker. */
const REPEAT_BONUS = 3;

/** Risk score is capped at this value. */
export const RISK_CAP = 100;

/** PRD: "Warn at 45." */
export const WARN_THRESHOLD = 45;

/** Case-insensitive phrase patterns per marker, tuned to PRD-1-SHIELD.md's
 * "typical phrasing" column and USER-FLOWS.md's example scripts. Each entry
 * is checked independently against every transcript line's text; a single
 * line may contribute more than one hit if it matches more than one pattern
 * for the same marker (e.g. "police... CBI..." in one sentence). */
const MARKER_PATTERNS: Readonly<Record<MarkerId, readonly RegExp[]>> = {
  authority: [
    /\bpolice\b/i,
    /\bcbi\b/i,
    /\btrai\b/i,
    /\bcourier\b/i,
    /\bbank\b/i,
    /\belectricity board\b/i,
    /\bincome tax\b/i,
    /\bcustoms\b/i,
    /\brbi\b/i,
    /\bcyber ?crime\b/i,
    /\bcyber cell\b/i,
    /\bofficer\b/i,
    /\bfedex\b/i,
    /\bnarcotics\b/i,
  ],
  threat: [
    /\barrest(ed|\s+warrant)?\b/i,
    /\bwarrant\b/i,
    /\bdisconnect(ion|ed)?\b/i,
    /\baccount\s+(will\s+be\s+|gets?\s+|is\s+)?block(ed)?\b/i,
    /\bfir\b/i,
    /\bjail\b/i,
    /\bcase\s+(will\s+be\s+)?filed\b/i,
    /\blegal\s+action\b/i,
    /\bsuspend(ed)?\s+your\s+(sim|number|service)\b/i,
    /\bdigital\s+arrest\b/i,
  ],
  isolation: [
    /\bstay\s+on\s+the\s+(call|line)\b/i,
    /\bdon'?t\s+(tell|inform)\s+(your\s+)?family\b/i,
    /\bdon'?t\s+(hang\s+up|disconnect)\b/i,
    /\bdo\s+not\s+tell\s+anyone\b/i,
    /\bkeep\s+this\s+(confidential|secret)\b/i,
    /\bdon'?t\s+tell\s+(anyone|your\s+parents)\b/i,
    /\bstay\s+on\s+video\s+call\b/i,
    /\bdo\s+not\s+disconnect\s+the\s+call\b/i,
  ],
  demand: [
    /\bupi\b/i,
    /\botp\b/i,
    /\bpin\b/i,
    /\banydesk\b/i,
    /\bteamviewer\b/i,
    /\bgift\s?card\b/i,
    /\btransfer\s+(the\s+)?money\b/i,
    /\bshare\s+your\s+(otp|pin)\b/i,
    /\binstall\s+(anydesk|teamviewer)\b/i,
    /\bpay(ment)?\s+(immediately|now)\b/i,
    /\bcredit\s?card\s+number\b/i,
    /\bsend\s+money\b/i,
  ],
  blocking: [
    /\bdon'?t\s+call\s+the\s+bank\b/i,
    /\bignore\s+the\s+warning\b/i,
    /\bdon'?t\s+verify\b/i,
    /\bthis\s+is\s+not\s+a\s+scam\b/i,
    /\bdon'?t\s+(check|contact)\s+(with\s+)?anyone\b/i,
    /\bdo\s+not\s+disconnect\s+and\s+verify\b/i,
    /\bdon'?t\s+tell\s+the\s+bank\b/i,
    /\bignore\s+(any\s+)?(sms|message|alert)\s+from\s+(the\s+)?bank\b/i,
    /\bit'?s\s+a\s+system\s+error\b/i,
  ],
};

/** Count how many pattern matches a single line contributes for a marker. */
function countHitsInLine(text: string, patterns: readonly RegExp[]): number {
  return patterns.reduce((count, pattern) => (pattern.test(text) ? count + 1 : count), 0);
}

/**
 * Score a transcript against the five scam-script markers.
 *
 * Pure and stateless: always recomputes from the full transcript, so calling
 * it again with a longer transcript (the normal case as a call proceeds)
 * can only add hits, never remove them. Risk is additionally folded into a
 * running max against `previousRisk` (if supplied) so a caller integrating
 * this incrementally is protected even if it ever recomputes with a
 * momentarily shorter view of the transcript (e.g. out-of-order delivery).
 */
export function scoreTranscript(
  lines: readonly TranscriptLine[],
  previousRisk = 0,
): MarkerScoreResult {
  const hitCounts: Record<MarkerId, number> = {
    authority: 0,
    threat: 0,
    isolation: 0,
    demand: 0,
    blocking: 0,
  };
  const fireOrder: MarkerId[] = [];

  for (const line of lines) {
    for (const markerId of MARKER_ORDER) {
      const hits = countHitsInLine(line.text, MARKER_PATTERNS[markerId]);
      if (hits === 0) continue;
      if (hitCounts[markerId] === 0) {
        fireOrder.push(markerId);
      }
      hitCounts[markerId] += hits;
    }
  }

  const rawScore = MARKER_ORDER.reduce((total, markerId) => {
    const hits = hitCounts[markerId];
    if (hits === 0) return total;
    const weight = MARKER_WEIGHTS[markerId];
    const repeats = hits - 1;
    return total + weight + repeats * REPEAT_BONUS;
  }, 0);

  const cappedScore = Math.min(RISK_CAP, rawScore);
  const risk = Math.max(cappedScore, Math.min(RISK_CAP, previousRisk));

  return { risk, markers: fireOrder };
}
