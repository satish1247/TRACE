import { NextResponse } from "next/server";
import { z } from "zod";
import { deepAnalysis } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

/**
 * Deep second opinion from the language model. Slow by nature (minutes on this network), so the
 * page calls it in the background while the deterministic verdict is already on screen.
 */
const Body = z.object({ text: z.string().min(1).max(8000) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "text required" }, { status: 400 });
  if (!process.env.NVIDIA_API_KEY) {
    return NextResponse.json({ ok: false, error: "No NVIDIA_API_KEY configured on the server" }, { status: 503 });
  }
  const started = Date.now();
  const verdict = await deepAnalysis(parsed.data.text);
  const ms = Date.now() - started;
  if (!verdict) {
    return NextResponse.json(
      { ok: false, error: `The model did not answer within the timeout (${Math.round(ms / 1000)}s)`, ms },
      { status: 504 },
    );
  }
  return NextResponse.json({ ok: true, verdict, ms });
}
