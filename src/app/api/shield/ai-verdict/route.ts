/**
 * SHIELD's optional LLM second opinion. Server-only: the NVIDIA API key
 * (`NVIDIA_API_KEY`) never reaches the browser bundle — this route is the
 * one place it is read, mirroring the "one writer" discipline used for
 * Firestore in `src/lib/shield/firestore.ts`.
 *
 * This is deliberately NOT the thing SHIELD depends on. REQUIREMENTS.md's
 * C4 requires the marker/taxonomy engines to be deterministic and testable
 * offline; this route is a slower, non-deterministic, optional complement —
 * if it's unreachable, misconfigured, or slow, the rest of the product is
 * unaffected. Every failure path returns a clear "unavailable" response
 * rather than throwing into a caller that might not expect it.
 */
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import type { AiVerdictResult } from "@/lib/shield/types";

export const dynamic = "force-dynamic";

const TranscriptLineSchema = z.object({
  speaker: z.enum(["caller", "user"]),
  text: z.string(),
  at: z.number(),
});

const RequestSchema = z.object({
  transcript: z.array(TranscriptLineSchema).min(1),
});

const MODEL = "deepseek-ai/deepseek-v4-pro-0813";
const REQUEST_TIMEOUT_MS = 8_000;

const VerdictSchema = z.object({
  isLikelyScam: z.boolean(),
  confidence: z.number().min(0).max(1),
  scamType: z.string().nullable(),
  explanation: z.string(),
});

function buildPrompt(transcript: z.infer<typeof RequestSchema>["transcript"]): string {
  const lines = transcript.map((line) => `${line.speaker === "caller" ? "Caller" : "User"}: ${line.text}`).join("\n");
  return [
    "You are a fraud-detection assistant reviewing a live phone call transcript for social-engineering scam patterns",
    "(e.g. fake police/CBI \"digital arrest\", courier scams, fake bank fraud alerts, tech support scams, isolation",
    "instructions like \"stay on the call, don't tell your family\", requests for OTP/PIN/UPI transfers, or instructions",
    "to ignore bank warnings).",
    "",
    "Transcript so far:",
    lines,
    "",
    "Respond with ONLY a JSON object, no other text, matching exactly this shape:",
    '{"isLikelyScam": boolean, "confidence": number between 0 and 1, "scamType": short snake_case string or null, "explanation": one short sentence}',
  ].join("\n");
}

function parseModelJson(content: string): z.infer<typeof VerdictSchema> | null {
  const trimmed = content.trim();
  const jsonMatch = /\{[\s\S]*\}/.exec(trimmed);
  if (!jsonMatch) return null;
  try {
    const parsed: unknown = JSON.parse(jsonMatch[0]);
    const result = VerdictSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI second opinion is not configured (missing NVIDIA_API_KEY)." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsedRequest = RequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return NextResponse.json({ error: "Expected { transcript: TranscriptLine[] }." }, { status: 400 });
  }

  const client = new OpenAI({ baseURL: "https://integrate.api.nvidia.com/v1", apiKey });

  try {
    const completion = await client.chat.completions.create(
      {
        model: MODEL,
        messages: [{ role: "user", content: buildPrompt(parsedRequest.data.transcript) }],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 300,
        seed: 42,
        stream: false,
      },
      { timeout: REQUEST_TIMEOUT_MS },
    );

    const content = completion.choices[0]?.message?.content ?? "";
    const parsedVerdict = parseModelJson(content);
    if (!parsedVerdict) {
      return NextResponse.json({ error: "Model response was not well-formed JSON." }, { status: 502 });
    }

    const result: AiVerdictResult = { ...parsedVerdict, model: MODEL };
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (cause: unknown) {
    const message = cause instanceof Error ? cause.message : "Unknown error calling the AI model.";
    console.error("SHIELD: ai-verdict request failed", cause);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
