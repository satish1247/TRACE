import { describe, expect, it } from "vitest";
import { classifyInterviewAnswer } from "./interview";

describe("classifyInterviewAnswer", () => {
  it("matches the digital-arrest excuse pattern and names the scam back", () => {
    const result = classifyInterviewAnswer(
      "I'm paying my nephew's bail after his arrest",
      "digital_arrest",
      "digital arrest",
    );
    expect(result.matchesScript).toBe(true);
    expect(result.matchedPhrases.length).toBeGreaterThan(0);
    expect(result.verdict).toContain("digital arrest");
  });

  it("falls back to generic excuse detection when no scam family is named yet", () => {
    const result = classifyInterviewAnswer("They said I need to pay customs for a parcel", null, null);
    expect(result.matchesScript).toBe(true);
  });

  it("does not falsely match an unrelated answer", () => {
    const result = classifyInterviewAnswer(
      "It's for my monthly grocery shopping",
      "digital_arrest",
      "digital arrest",
    );
    expect(result.matchesScript).toBe(false);
  });

  it("handles an empty answer without matching", () => {
    const result = classifyInterviewAnswer("   ", "digital_arrest", "digital arrest");
    expect(result.matchesScript).toBe(false);
    expect(result.matchedPhrases).toEqual([]);
  });
});
