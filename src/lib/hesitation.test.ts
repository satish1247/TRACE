import { describe, expect, it } from "vitest";
import { hesitationIndex } from "./hesitation";

describe("hesitation index", () => {
  it("fluent typing scores near zero", () => {
    const ev = [0, 180, 350, 520, 700].map((t, i) => ({ t, key: String(i) }));
    expect(hesitationIndex(ev)).toBeLessThan(0.2);
  });

  it("type, pause, erase, retype scores high", () => {
    const ev = [
      { t: 0, key: "5" },
      { t: 200, key: "0" },
      { t: 2200, key: "Backspace" },
      { t: 2500, key: "Backspace" },
      { t: 4500, key: "5" },
      { t: 4700, key: "0" },
      { t: 4900, key: "0" },
    ];
    expect(hesitationIndex(ev)).toBeGreaterThan(0.6);
  });

  it("returns 0 with fewer than two events", () => {
    expect(hesitationIndex([])).toBe(0);
    expect(hesitationIndex([{ t: 0, key: "1" }])).toBe(0);
  });
});
