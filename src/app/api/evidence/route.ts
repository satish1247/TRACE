import { NextResponse } from "next/server";
import { getState } from "@/lib/store";

export const dynamic = "force-dynamic";

export function GET() {
  const { evidence } = getState();
  if (!evidence) return NextResponse.json({ ok: false, error: "No confirmed incident yet" }, { status: 404 });
  return NextResponse.json({ ok: true, evidence });
}
