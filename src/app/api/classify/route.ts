import { NextResponse } from "next/server";
import { z } from "zod";
import { classifyNarrative } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

const Body = z.object({ text: z.string().max(2000) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "text required" }, { status: 400 });
  return NextResponse.json({ ok: true, ...classifyNarrative(parsed.data.text) });
}
