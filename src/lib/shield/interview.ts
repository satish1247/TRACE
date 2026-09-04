/**
 * Pure, deterministic classifier for the "interview" flow from
 * PRD-1-SHIELD.md — not a warning banner. Given the free-text (spoken or
 * typed) answer to "In your own words, who is this money for, and why?",
 * checks it against the named scam family's typical excuse pattern and
 * returns a one-sentence verdict that names the scam back to the user.
 */
import type { InterviewResult } from "./types";

/** Excuse phrases typical of each scam family's cover story, keyed by the
 * same `scamType` ids `taxonomy.ts` produces. */
const EXCUSE_PATTERNS: Readonly<Record<string, readonly RegExp[]>> = {
  digital_arrest: [/\bbail\b/i, /\barrest\b/i, /\bcbi\b/i, /\bpolice\b/i, /\bwarrant\b/i, /\bcourt\b/i, /\bcase\b/i],
  courier_scam: [/\bcustoms\b/i, /\bparcel\b/i, /\bcourier\b/i, /\billegal\b/i, /\bfine\b/i, /\bpackage\b/i],
  bank_fraud_alert: [/\botp\b/i, /\bpin\b/i, /\bkyc\b/i, /\baccount\b/i, /\bbank\b/i, /\bcard\b/i],
  electricity_disconnection: [/\belectricity\b/i, /\bbill\b/i, /\bdisconnect/i],
  tech_support_scam: [/\bvirus\b/i, /\bcomputer\b/i, /\bsupport\b/i, /\bremote\b/i, /\banydesk\b/i],
  lottery_prize_scam: [/\blottery\b/i, /\bprize\b/i, /\bwinning\b/i, /\bclaim\b/i, /\bfee\b/i],
  investment_scam: [/\binvestment\b/i, /\btrading\b/i, /\breturns?\b/i, /\bprofit\b/i],
  loan_app_scam: [/\bloan\b/i, /\bemi\b/i, /\brepay\b/i],
  sextortion: [/\bvideo\b/i, /\bphoto\b/i, /\bblackmail\b/i],
  job_scam: [/\bjob\b/i, /\bregistration\b/i, /\bwork\b/i],
};

/** Checked when no scam family has been named yet, so the interview can
 * still surface a hit even before `taxonomy.ts` resolves a family. */
const GENERIC_EXCUSE_PATTERNS: readonly RegExp[] = [
  /\bbail\b/i,
  /\barrest\b/i,
  /\bcustoms\b/i,
  /\botp\b/i,
  /\bgift ?card\b/i,
];

function findMatches(answer: string, patterns: readonly RegExp[]): string[] {
  return patterns.filter((pattern) => pattern.test(answer)).map((pattern) => pattern.source.replace(/\\b|\\/g, ""));
}

/**
 * Classify a free-text interview answer against the named scam's typical
 * excuse pattern, and produce a one-sentence verdict naming the scam back.
 */
export function classifyInterviewAnswer(
  answer: string,
  scamType: string | null,
  scamLabel: string | null,
): InterviewResult {
  const trimmed = answer.trim();
  if (trimmed.length === 0) {
    return {
      matchesScript: false,
      matchedPhrases: [],
      verdict: "No answer given yet — the interview question is still waiting for a reply.",
    };
  }

  const scopedPatterns = scamType ? EXCUSE_PATTERNS[scamType] : undefined;
  const matchedPhrases = scopedPatterns
    ? findMatches(trimmed, scopedPatterns)
    : findMatches(trimmed, GENERIC_EXCUSE_PATTERNS);

  const matchesScript = matchedPhrases.length > 0;

  if (matchesScript && scamLabel) {
    return {
      matchesScript,
      matchedPhrases,
      verdict: `That explanation matches the ${scamLabel} scam's typical excuse (mentions "${matchedPhrases[0]}") — no legitimate authority asks for payment this way over a call.`,
    };
  }

  if (matchesScript) {
    return {
      matchesScript,
      matchedPhrases,
      verdict: `That explanation contains a common scam-excuse phrase ("${matchedPhrases[0]}") — treat this call as suspicious and verify independently before paying.`,
    };
  }

  return {
    matchesScript: false,
    matchedPhrases: [],
    verdict:
      "That explanation doesn't match a known scam-excuse pattern yet — stay cautious and verify independently before paying anyone on this call.",
  };
}
