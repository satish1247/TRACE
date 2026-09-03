import { getState, listenerCount, subscribe } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Server-Sent Events: the server pushes state the instant it changes.
 * Replaces polling. Every screen holds one open connection, so a payment held on the phone
 * reaches the guardian's screen in milliseconds rather than on the next poll tick.
 */
export function GET(req: Request) {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* client vanished */
        }
      };

      // current state immediately, so a screen renders without waiting for a change
      send("state", { version: getState().version, state: getState(), now: Date.now(), clients: listenerCount() + 1 });

      unsubscribe = subscribe((s) => send("state", { version: s.version, state: s, now: Date.now(), clients: listenerCount() }));

      // keeps proxies and phone radios from closing an idle connection
      heartbeat = setInterval(() => send("ping", { now: Date.now(), clients: listenerCount() }), 15_000);

      req.signal.addEventListener("abort", () => {
        unsubscribe?.();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
