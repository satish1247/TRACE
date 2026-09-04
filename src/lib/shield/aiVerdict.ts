/**
 * Client-side caller for `/api/shield/ai-verdict`. Never talks to NVIDIA
 * directly — the API key lives server-side only (see that route's header).
 *
 * Deliberately swallows every failure into `null` rather than throwing: this
 * is an optional second opinion (PRD-1-SHIELD.md's script-based engine is
 * what the product depends on), so a slow or misconfigured LLM must never
 * block or crash the live call screen.
 */
import type { AiVerdictResult, TranscriptLine } from "./types";

const CLIENT_TIMEOUT_MS = 10_000;

export async function fetchAiVerdict(transcript: readonly TranscriptLine[]): Promise<AiVerdictResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

  try {
    const response = await fetch("/api/shield/ai-verdict", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transcript }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error("SHIELD: ai-verdict request failed", response.status, await response.text().catch(() => ""));
      return null;
    }

    const data: unknown = await response.json();
    return data as AiVerdictResult;
  } catch (cause: unknown) {
    console.error("SHIELD: ai-verdict request errored", cause);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
