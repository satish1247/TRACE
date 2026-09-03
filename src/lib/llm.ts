import type { Classification } from "./types";

/**
 * Optional wording enhancer via OpenRouter (OpenAI-compatible API).
 * Never on the critical path: the deterministic rebuttal is already on screen before this runs,
 * and any failure, timeout or missing key returns null.
 */
export const LLM_TIMEOUT_MS = 3000;

export async function warmRebuttal(c: Classification, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LLM_TIMEOUT_MS);
  try {
    const r = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "TRACE",
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        max_tokens: 180,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You rewrite a fraud-warning for a frightened 68-year-old in Chennai. Warm, calm, simple English, two short sentences, then one short Tamil sentence. Add no facts, numbers or names that are not in the input. No emojis.",
          },
          { role: "user", content: `Scam: ${c.label}\nMessage to rewrite: ${c.rebuttal}` },
        ],
      }),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    const text = j.choices?.[0]?.message?.content?.trim();
    return text && text.length > 0 && text.length < 600 ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
