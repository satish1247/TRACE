import { NextResponse } from "next/server";
import { z } from "zod";
import { ActionError, dispatch, getState } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Endpoint for the Android app (TRACE Guard).
 *
 * The phone captures the call, transcribes it on the device, and posts each line here.
 * The analysis happens on this server and appears on /stage within milliseconds, because the
 * reducer pushes to every open SSE connection. Deliberately no role header and permissive CORS,
 * so the app needs no configuration beyond the address.
 */
const Body = z.object({
  event: z.enum(["start", "line", "end"]),
  text: z.string().max(2000).optional(),
  caller: z.string().max(120).optional(),
});

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "expected {event, text?, caller?}" }, { status: 400, headers: CORS });
  }
  const { event, text, caller } = parsed.data;
  try {
    if (event === "start") dispatch({ type: "phone.start", payload: { caller } }, "phone");
    else if (event === "end") dispatch({ type: "phone.end" }, "phone");
    else dispatch({ type: "phone.line", payload: { text: text ?? "", caller } }, "phone");
  } catch (e) {
    if (e instanceof ActionError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status, headers: CORS });
    console.error("[trace] phone endpoint failed", e);
    return NextResponse.json({ ok: false, error: "internal error" }, { status: 500, headers: CORS });
  }

  // hand the verdict straight back, so the phone can show it even without the web screen
  const s = getState();
  return NextResponse.json(
    {
      ok: true,
      risk: s.call.risk,
      markers: Array.from(new Set(s.call.markers.map((m) => m.kind))),
      scam: s.call.classification?.scam ?? null,
      label: s.call.classification?.label ?? null,
      rebuttal: s.call.classification?.rebuttal ?? null,
      attestation: s.call.attestationLine,
    },
    { headers: CORS },
  );
}
