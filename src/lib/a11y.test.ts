import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Presence checks for the accessibility affordances REQ-017 asks for. Behavioural checks are in the manual walkthrough (TEST-PLAN.md). */
describe("accessibility affordances are present in the built screens", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const phone = readFileSync("src/app/phone/page.tsx", "utf8");
  const stage = readFileSync("src/app/stage/page.tsx", "utf8");

  it("large-text mode and visible focus rings exist", () => {
    expect(css).toMatch(/\.large-text\s*\{\s*font-size:\s*125%/);
    expect(css).toMatch(/focus-visible/);
    expect(css).toMatch(/prefers-reduced-motion/);
  });

  it("the phone screen labels its controls and persists the large-text choice", () => {
    expect(phone).toMatch(/aria-label="UPI ID"/);
    expect(phone).toMatch(/aria-label="Your answer"/);
    expect(phone).toMatch(/aria-pressed=\{large\}/);
    expect(phone).toMatch(/localStorage\.setItem\("trace\.large"/);
  });

  it("colour is never the only signal: tiers and verdicts carry text", () => {
    expect(stage).toMatch(/<Tag[^>]*>\{t\.verdict\}<\/Tag>/);
    expect(phone).toMatch(/Paid before|New payee/);
  });
});
