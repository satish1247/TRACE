import { NextResponse } from "next/server";
import { z } from "zod";
import { ActionError, dispatch, getState } from "@/lib/store";
import { warmRebuttal } from "@/lib/llm";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

const Body = z.object({
  type: z.string().min(1).max(64),
  payload: z.record(z.unknown()).optional(),
});

const ROLES: Role[] = ["phone", "guardian", "stage", "presenter"];

export async function POST(req: Request) {
  const role = req.headers.get("x-trace-role") as Role | null;
  if (!role || !ROLES.includes(role)) return NextResponse.json({ ok: false, error: "missing or invalid x-trace-role" }, { status: 403 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "body must be JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  try {
    const state = dispatch(parsed.data, role);
    if (parsed.data.type === "interview.answer") {
      // optional, after the fact: the deterministic rebuttal is already on screen
      const c = state.payment.interview?.classification;
      const version = state.version;
      if (c) {
        void warmRebuttal(c).then((text) => {
          if (text && getState().version >= version && getState().payment.interview?.classification?.scam === c.scam) {
            try {
              dispatch({ type: "interview.warm", payload: { text } }, "phone");
            } catch {
              /* state moved on; ignore */
            }
          }
        });
      }
    }
    return NextResponse.json({ ok: true, version: state.version });
  } catch (e) {
    if (e instanceof ActionError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    console.error("[trace] action failed", parsed.data.type, e);
    return NextResponse.json({ ok: false, error: "internal error" }, { status: 500 });
  }
}
