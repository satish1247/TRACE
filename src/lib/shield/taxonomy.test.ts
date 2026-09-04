import { describe, expect, it } from "vitest";
import { scoreTranscript } from "./markers";
import { ALL_SCAM_FAMILIES, classifyScam } from "./taxonomy";
import type { TranscriptLine } from "./types";

const DIGITAL_ARREST_SCRIPT: readonly TranscriptLine[] = [
  { speaker: "caller", text: "This is CBI calling about your case.", at: 1 },
  { speaker: "caller", text: "You will be arrested if you do not comply.", at: 2 },
  { speaker: "caller", text: "Stay on the call and don't disconnect.", at: 3 },
  { speaker: "caller", text: "Share your OTP and complete a UPI transfer now.", at: 4 },
  { speaker: "caller", text: "Don't call the bank, ignore the warning message.", at: 5 },
];

describe("classifyScam", () => {
  it("names the digital-arrest scam family for the scripted transcript, with a statistic", () => {
    const { markers } = scoreTranscript(DIGITAL_ARREST_SCRIPT);
    const result = classifyScam(DIGITAL_ARREST_SCRIPT, markers);
    expect(result.scamType).toBe("digital_arrest");
    expect(result.label).toBe("digital arrest");
    expect(result.statistic).toBeTruthy();
  });

  it("reports no match for an empty transcript rather than guessing", () => {
    const result = classifyScam([], []);
    expect(result.scamType).toBeNull();
    expect(result.label).toBeNull();
    expect(result.statistic).toBeNull();
  });

  it("reports no match for a transcript with no scam-family keywords", () => {
    const chat: TranscriptLine[] = [{ speaker: "caller", text: "Let's catch up over coffee sometime.", at: 1 }];
    const result = classifyScam(chat, []);
    expect(result.scamType).toBeNull();
  });

  it("exposes at least 8 scam families, each with an id, label and statistic", () => {
    expect(ALL_SCAM_FAMILIES.length).toBeGreaterThanOrEqual(8);
    for (const family of ALL_SCAM_FAMILIES) {
      expect(family.id.length).toBeGreaterThan(0);
      expect(family.label.length).toBeGreaterThan(0);
      expect(family.statistic.length).toBeGreaterThan(0);
    }
  });
});
