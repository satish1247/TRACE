import type { TraceNode } from "./types";

/**
 * Proportional Freeze.
 *  - Haircut taint: taint attaches to value pro-rata, not to accounts.
 *  - Dilution per hop emerges from mixing; a hop cap stops tracing beyond MAX_HOP.
 *  - De-minimis floor: below FLOOR rupees, propagation stops and nothing is held.
 *  - A hold can never exceed what the account actually still has.
 */
export const FLOOR = 15;
export const MAX_HOP = 6;

export function currentBalance(n: TraceNode): number {
  return n.balanceBefore + n.received - n.forwarded;
}

export function taintRatio(n: TraceNode): number {
  const inflow = n.balanceBefore + n.received;
  return inflow > 0 ? n.taint / inflow : 0;
}

/** Pure: returns new nodes with taint/held computed in hop order. Input nodes must already carry received/forwarded. */
export function propagateTaint(nodes: TraceNode[], floor = FLOOR): TraceNode[] {
  const byId = new Map<string, TraceNode>();
  const ordered = [...nodes].sort((a, b) => a.hop - b.hop);
  const out: TraceNode[] = [];
  for (const n of ordered) {
    let taint = 0;
    if (n.kind === "scammer" && n.parentId) {
      taint = n.received; // L1: everything the victim sent is stolen
    } else if (n.parentId) {
      const p = byId.get(n.parentId);
      taint = p ? n.received * taintRatio(p) : 0;
    }
    if (n.hop > MAX_HOP) taint = 0;
    taint = round2(taint);
    const canHold = n.kind !== "victim" && n.kind !== "cashout";
    const held = canHold && taint >= floor ? round2(Math.min(taint, currentBalance(n))) : 0;
    const next: TraceNode = { ...n, taint, held };
    byId.set(next.id, next);
    out.push(next);
  }
  return out;
}

export function recoveredTotal(nodes: TraceNode[]): number {
  return round2(nodes.filter((n) => n.revealed).reduce((a, n) => a + n.held, 0));
}

export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Deterministic tree for the demo: Rs 50,000 leaves Lakshmi. Fresh mule accounts start empty. */
export function buildTree(amount: number, victimVpa: string, victimName: string): TraceNode[] {
  const nodes: TraceNode[] = [];
  const add = (n: Omit<TraceNode, "taint" | "held" | "revealed">) => nodes.push({ ...n, taint: 0, held: 0, revealed: false });

  add({ id: "V", hop: 0, label: victimName, vpa: victimVpa, kind: "victim", balanceBefore: 84_320, received: 0, forwarded: amount, settlement: false, parentId: null });
  add({ id: "S", hop: 1, label: "Verification Desk", vpa: "verification-desk@fedbank", kind: "scammer", balanceBefore: 0, received: amount, forwarded: amount, settlement: false, parentId: "V" });

  const perMule = Math.round(amount / 10);
  const muleNames = ["Rohit Kumar", "Suresh Yadav", "Amit Singh", "Vikram R", "Deepak M", "Sanjay P", "Nitin K", "Manoj T", "Rahul B", "Arjun S"];
  for (let i = 0; i < 10; i++) {
    const id = `M${i + 1}`;
    let forwarded = 0;
    let settlement = true;
    if (i === 0) { forwarded = 20 + 4_900; settlement = false; } // tea shop + cash-out
    if (i === 1) { forwarded = 4_800; settlement = false; } // deeper layering
    if (i === 2 || i === 3) { forwarded = perMule; settlement = false; } // cashed out fully
    add({ id, hop: 2, label: muleNames[i], vpa: `${muleNames[i].toLowerCase().replace(/\s+/g, ".")}@okbank`, kind: "mule", balanceBefore: 0, received: perMule, forwarded, settlement, parentId: "S" });
  }

  add({ id: "T", hop: 3, label: "Murugan Tea Stall", vpa: "murugan.tea@ybl", kind: "merchant", balanceBefore: 2_00_000, received: 20, forwarded: 10, settlement: true, parentId: "M1" });
  add({ id: "C1", hop: 3, label: "ATM cash-out, Anand Vihar", vpa: "cash", kind: "cashout", balanceBefore: 0, received: 4_900, forwarded: 0, settlement: false, parentId: "M1" });
  add({ id: "M11", hop: 3, label: "Pooja Traders", vpa: "pooja.traders@okbank", kind: "mule", balanceBefore: 0, received: 4_800, forwarded: 4_500, settlement: false, parentId: "M2" });
  add({ id: "C2", hop: 3, label: "ATM cash-out, Kanpur", vpa: "cash", kind: "cashout", balanceBefore: 0, received: perMule, forwarded: 0, settlement: false, parentId: "M3" });
  add({ id: "C3", hop: 3, label: "Crypto P2P off-ramp", vpa: "p2p", kind: "cashout", balanceBefore: 0, received: perMule, forwarded: 0, settlement: false, parentId: "M4" });

  add({ id: "K", hop: 4, label: "Ravi (bought tea)", vpa: "ravi.k@paytm", kind: "individual", balanceBefore: 8_600, received: 10, forwarded: 0, settlement: false, parentId: "T" });
  add({ id: "M12", hop: 4, label: "Neha Enterprises", vpa: "neha.ent@okbank", kind: "mule", balanceBefore: 0, received: 4_500, forwarded: 0, settlement: true, parentId: "M11" });

  return propagateTaint(nodes);
}

export function revealHops(nodes: TraceNode[], upToHop: number): TraceNode[] {
  return nodes.map((n) => (n.hop <= upToHop ? { ...n, revealed: true } : n));
}

export function maxHop(nodes: TraceNode[]): number {
  return nodes.reduce((m, n) => Math.max(m, n.hop), 0);
}
