import type { Classification } from "./types";

/**
 * Deep second opinion from a real language model, via NVIDIA's OpenAI-compatible endpoint.
 *
 * Measured latency on the venue network is roughly three to four minutes per reply, so this is
 * deliberately never on the demo's critical path. The deterministic engine answers instantly and
 * offline; this runs afterwards, asynchronously, and adds nuance a rule set cannot reach.
 */
export interface DeepVerdict {
  isScam: boolean;
  scamType: string;
  confidence: number;
  reasoning: string;
  advice: string;
  raw?: string;
}

const SYSTEM = `You are a fraud analyst for an Indian bank, reviewing a transcript of a phone call.
Decide whether the caller is running a scam against the person on the other end.
Reply with ONLY a JSON object, no prose and no code fence:
{"isScam": true|false, "scamType": "short name or 'none'", "confidence": 0.0-1.0,
 "reasoning": "two sentences on what in the words made you decide",
 "advice": "one sentence a frightened 68-year-old could act on"}`;

/** Measured on this network: about half the requests never return, so one retry is worth it. */
export async function deepAnalysis(transcript: string, fetchImpl: typeof fetch = fetch): Promise<DeepVerdict | null> {
  const first = await deepAnalysisOnce(transcript, fetchImpl);
  if (first) return first;
  return deepAnalysisOnce(transcript, fetchImpl);
}

async function deepAnalysisOnce(transcript: string, fetchImpl: typeof fetch = fetch): Promise<DeepVerdict | null> {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) return null;
  const base = (process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/$/, "");
  const model = process.env.NVIDIA_MODEL || "deepseek-ai/deepseek-v4-pro-0813";
  const timeout = Number(process.env.NVIDIA_TIMEOUT_MS || 240000);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetchImpl(`${base}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: transcript.slice(0, 6000) },
        ],
        temperature: 0.2,
        top_p: 0.95,
        max_tokens: 400,
        // the model reasons for minutes with this on; the analyst prompt does not need it
        chat_template_kwargs: { thinking: false },
      }),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    const text = j.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { isScam: false, scamType: "unparsed", confidence: 0, reasoning: text.slice(0, 400), advice: "", raw: text };
    const parsed = JSON.parse(match[0]) as Partial<DeepVerdict>;
    return {
      isScam: Boolean(parsed.isScam),
      scamType: String(parsed.scamType ?? "unknown"),
      confidence: Number(parsed.confidence ?? 0),
      reasoning: String(parsed.reasoning ?? ""),
      advice: String(parsed.advice ?? ""),
      raw: text,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

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
