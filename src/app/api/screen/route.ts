import { NextResponse } from "next/server";
import { z } from "zod";
import { detectMarkers, riskFromMarkers } from "@/lib/screening";

export const dynamic = "force-dynamic";

const Body = z.object({ text: z.string().max(2000) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "text required" }, { status: 400 });
  const markers = detectMarkers(parsed.data.text);
  return NextResponse.json({ ok: true, markers, riskDelta: riskFromMarkers(markers) });
}
