import { describe, expect, it } from "vitest";
import { MARKER_ORDER, RISK_CAP, WARN_THRESHOLD, scoreTranscript } from "./markers";
import type { TranscriptLine } from "./types";

/** Scripted "digital arrest" call: one line per marker, in PRD order, each
 * phrased close to PRD-1-SHIELD.md's "typical phrasing" column. */
const DIGITAL_ARREST_SCRIPT: readonly TranscriptLine[] = [
  { speaker: "caller", text: "This is CBI calling about your case.", at: 1 },
  { speaker: "caller", text: "You will be arrested if you do not comply.", at: 2 },
  { speaker: "caller", text: "Stay on the call and don't disconnect.", at: 3 },
  { speaker: "caller", text: "Share your OTP and complete a UPI transfer now.", at: 4 },
  { speaker: "caller", text: "Don't call the bank, ignore the warning message.", at: 5 },
];

describe("scoreTranscript", () => {
  it("fires all five markers, in the scripted order, and drives risk past the warn threshold", () => {
    const result = scoreTranscript(DIGITAL_ARREST_SCRIPT);
    expect(result.markers).toEqual(["authority", "threat", "isolation", "demand", "blocking"]);
    expect(result.risk).toBeGreaterThan(WARN_THRESHOLD);
    expect(result.risk).toBeLessThanOrEqual(RISK_CAP);
  });

  it("risk never decreases as the transcript grows one line at a time", () => {
    let previousRisk = 0;
    for (let i = 1; i <= DIGITAL_ARREST_SCRIPT.length; i += 1) {
      const partial = DIGITAL_ARREST_SCRIPT.slice(0, i);
      const { risk } = scoreTranscript(partial, previousRisk);
      expect(risk).toBeGreaterThanOrEqual(previousRisk);
      previousRisk = risk;
    }
    expect(previousRisk).toBeGreaterThan(WARN_THRESHOLD);
  });

  it("caps risk at 100 even with many repeated marker phrases", () => {
    const repeatedLine =
      "Stay on the call and don't tell your family. Share your OTP now. This is CBI. You will be arrested. Don't call the bank.";
    const repeated: TranscriptLine[] = Array.from({ length: 20 }, (_, i) => ({
      speaker: "caller",
      text: repeatedLine,
      at: i,
    }));
    const { risk } = scoreTranscript(repeated);
    expect(risk).toBe(RISK_CAP);
  });

  it("stays at zero for an unrelated transcript and lights no markers", () => {
    const chat: TranscriptLine[] = [{ speaker: "caller", text: "Hi, how is the weather today?", at: 1 }];
    const { risk, markers } = scoreTranscript(chat);
    expect(risk).toBe(0);
    expect(markers).toEqual([]);
  });

  it("stays at zero for an empty transcript", () => {
    const { risk, markers } = scoreTranscript([]);
    expect(risk).toBe(0);
    expect(markers).toEqual([]);
  });

  it("exposes the five markers in the PRD's fixed left-to-right order", () => {
    expect(MARKER_ORDER).toEqual(["authority", "threat", "isolation", "demand", "blocking"]);
  });
});
