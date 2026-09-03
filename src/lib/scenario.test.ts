import { describe, expect, it } from "vitest";
import { VERIFIED_HELP, seed } from "./scenario";
import { reduce } from "./store";

describe("verified-link shield", () => {
  it("intercepts a customer-care search with the verified bank number", () => {
    const hit = VERIFIED_HELP.find((h) => h.match.test("phonepe customer care number"));
    expect(hit?.number).toBeTruthy();
    expect(hit?.note).toMatch(/never call a number from search results/i);
  });

  it("routes fraud and cyber searches to the 1930 helpline", () => {
    const hit = VERIFIED_HELP.find((h) => h.match.test("report cyber fraud"));
    expect(hit?.number).toBe("1930");
  });

  it("logs the interception as an event and ignores unrelated searches", () => {
    const s0 = seed(1_700_000_000_000);
    const s1 = reduce(s0, { type: "search.query", payload: { q: "customer care" } }, 1_700_000_000_500);
    expect(s1.events.at(-1)?.type).toBe("search.intercept");
    const s2 = reduce(s0, { type: "search.query", payload: { q: "sari shop" } }, 1_700_000_000_500);
    expect(s2.events.length).toBe(s0.events.length);
  });
});
