/**
 * Shared TypeScript shapes for the SHIELD module.
 *
 * These mirror `SCHEMA.md` / `.claude/project/DATABASE.md` exactly — SHIELD
 * does not change these shapes unilaterally; any change needs agreement with
 * TRACK and AGENT's owners (see SCHEMA.md at the repo root).
 */

/** One of the five scam-script markers from PRD-1-SHIELD.md, in fixed order. */
export type MarkerId = "authority" | "threat" | "isolation" | "demand" | "blocking";

/** Who spoke a given transcript line. */
export type Speaker = "caller" | "user";

/** One line of a call transcript, regardless of whether it came from the mic
 * (Web Speech API) or the typed-input fallback — downstream code never knows
 * which source produced it. */
export interface TranscriptLine {
  speaker: Speaker;
  text: string;
  /** epoch milliseconds */
  at: number;
}

/** `calls/{callId}` — SHIELD-owned, written by `firestore.ts` only. */
export interface Call {
  /** epoch milliseconds */
  startedAt: number;
  callerId: string;
  callerName: string;
  transcript: TranscriptLine[];
  markers: MarkerId[];
  /** 0..100, monotonically non-decreasing within one call's lifetime */
  risk: number;
  /** e.g. 'digital_arrest'; null until named */
  scamType: string | null;
  active: boolean;
}

export type DetectionKind = "voice" | "face" | "transcript";
export type DetectionVerdict = "real" | "fake" | "uncertain";

/** `detections/{id}` — SHIELD-owned, written by `firestore.ts` only. */
export interface Detection {
  /** epoch milliseconds */
  at: number;
  kind: DetectionKind;
  verdict: DetectionVerdict;
  /** 0..1 */
  confidence: number;
  model: string;
  evidence: Record<string, string | number>;
  callId: string | null;
}

/** Result of scoring a transcript against the five markers (`markers.ts`). */
export interface MarkerScoreResult {
  /** 0..100, capped, monotonically non-decreasing across successive calls
   * with a growing transcript */
  risk: number;
  markers: MarkerId[];
}

/** One named scam family in the taxonomy (`taxonomy.ts`). */
export interface ScamFamily {
  id: string;
  label: string;
  statistic: string;
}

/** Result of naming the scam a transcript matches (`taxonomy.ts`). */
export interface TaxonomyResult {
  scamType: string | null;
  label: string | null;
  statistic: string | null;
}

/** Result of classifying an interview answer (`interview.ts`). */
export interface InterviewResult {
  matchesScript: boolean;
  matchedPhrases: string[];
  verdict: string;
}

/** Result of an attestation lookup (`attestation.ts`). */
export interface AttestationResult {
  attested: boolean;
  message: string;
}

/** Result of the optional LLM second opinion (`aiVerdict.ts` + the
 * `/api/shield/ai-verdict` route). A network-dependent, non-deterministic
 * complement to the deterministic marker/taxonomy engines above — never the
 * thing the product depends on, per PRD-1-SHIELD.md's "read the script
 * first" framing. */
export interface AiVerdictResult {
  isLikelyScam: boolean;
  confidence: number;
  scamType: string | null;
  explanation: string;
  model: string;
}
