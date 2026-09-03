import { NextResponse } from "next/server";
import { getState } from "@/lib/store";

export const dynamic = "force-dynamic";

export function GET() {
  const state = getState();
  return NextResponse.json({ version: state.version, state, now: Date.now() }, { headers: { "cache-control": "no-store" } });
}
