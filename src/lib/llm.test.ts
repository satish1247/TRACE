import { afterEach, describe, expect, it } from "vitest";
import { warmRebuttal } from "./llm";
import { classifyNarrative } from "./taxonomy";

const c = classifyNarrative("police called about my aadhaar and a money laundering case, I must pay verification");

describe("OpenRouter wording enhancer (optional)", () => {
  const saved = process.env.OPENROUTER_API_KEY;
  afterEach(() => {
    if (saved === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = saved;
  });

  it("returns null immediately when no key is configured", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const t0 = performance.now();
    expect(await warmRebuttal(c)).toBeNull();
    expect(performance.now() - t0).toBeLessThan(50);
  });

  it("returns null on any transport failure and never throws", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const failing = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    expect(await warmRebuttal(c, failing)).toBeNull();
  });

  it("returns the model's text when the call succeeds", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const ok = (async () => new Response(JSON.stringify({ choices: [{ message: { content: "Amma, no police collects money by phone. You are safe." } }] }), { status: 200 })) as unknown as typeof fetch;
    expect(await warmRebuttal(c, ok)).toMatch(/Amma/);
  });
});
