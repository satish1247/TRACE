"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Role, State } from "./types";

export const POLL_MS = 1500; // fallback only; the live path is Server-Sent Events

export type Transport = "live" | "polling" | "offline";

/**
 * Subscribes to the server's push stream. Falls back to polling if EventSource is
 * unavailable or the stream drops, so the demo degrades instead of dying.
 */
export function usePoll() {
  const [state, setState] = useState<State | null>(null);
  const [connected, setConnected] = useState(true);
  const [transport, setTransport] = useState<Transport>("live");
  const [clients, setClients] = useState(1);
  const [serverNow, setServerNow] = useState<number>(Date.now());
  const version = useRef(0);

  useEffect(() => {
    let stopped = false;
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const apply = (j: { version: number; state: State; now: number; clients?: number }) => {
      setServerNow(j.now);
      if (typeof j.clients === "number") setClients(j.clients);
      if (j.version !== version.current) {
        version.current = j.version;
        setState(j.state);
      }
    };

    const poll = async () => {
      try {
        const r = await fetch("/api/state", { cache: "no-store" });
        apply((await r.json()) as { version: number; state: State; now: number });
        if (!stopped) setConnected(true);
      } catch {
        if (!stopped) {
          setConnected(false);
          setTransport("offline");
        }
      }
    };

    const startPolling = () => {
      if (pollTimer || stopped) return;
      setTransport("polling");
      void poll();
      pollTimer = setInterval(poll, POLL_MS);
    };

    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    };

    const connect = () => {
      if (stopped || typeof EventSource === "undefined") {
        startPolling();
        return;
      }
      es = new EventSource("/api/stream");

      es.addEventListener("state", (e) => {
        stopPolling();
        setConnected(true);
        setTransport("live");
        apply(JSON.parse((e as MessageEvent).data));
      });

      es.addEventListener("ping", (e) => {
        const d = JSON.parse((e as MessageEvent).data) as { now: number; clients: number };
        setServerNow(d.now);
        setClients(d.clients);
        setConnected(true);
      });

      es.onerror = () => {
        es?.close();
        es = null;
        if (stopped) return;
        setConnected(false);
        startPolling(); // keep working while we retry the stream
        retry = setTimeout(connect, 2000);
      };
    };

    connect();
    return () => {
      stopped = true;
      es?.close();
      stopPolling();
      if (retry) clearTimeout(retry);
    };
  }, []);

  return { state, connected, transport, clients, serverNow };
}

export function useAct(role: Role) {
  const [error, setError] = useState<string | null>(null);
  const act = useCallback(
    async (type: string, payload?: Record<string, unknown>) => {
      setError(null);
      try {
        const r = await fetch("/api/action", {
          method: "POST",
          headers: { "content-type": "application/json", "x-trace-role": role },
          body: JSON.stringify({ type, payload }),
        });
        const j = (await r.json()) as { ok: boolean; error?: string };
        if (!j.ok) setError(j.error ?? "Something went wrong");
        return j.ok;
      } catch {
        setError("Reconnecting to TRACE...");
        return false;
      }
    },
    [role],
  );
  return { act, error, clearError: () => setError(null) };
}

export function inr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export function inr2(n: number): string {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

export function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
