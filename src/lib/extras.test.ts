import { describe, expect, it } from "vitest";
import { MEDIA_SAMPLES } from "./media";
import { checkLender } from "./lenders";
import { AGENT_LIMIT, nextAgentStep, startAgent } from "./agent";
import { detectMarkers } from "./screening";
import { DIGITAL_ARREST, seed } from "./scenario";
import { reduce } from "./store";

const T0 = 1_700_000_000_000;

describe("synthetic-media indicator (simulated)", () => {
  it("the real scammer sounds authentic while the script still flags him", () => {
    expect(MEDIA_SAMPLES.real_scammer.verdict).toBe("authentic");
    const hits = DIGITAL_ARREST.flatMap((l, i) => detectMarkers(l.text, i));
    expect(hits.length).toBeGreaterThan(4);
  });
  it("a cloned voice is called synthetic with named signals", () => {
    const c = MEDIA_SAMPLES.cloned_voice;
    expect(c.verdict).toBe("synthetic");
    expect(c.signals.filter((s) => s.suspicious).length).toBeGreaterThanOrEqual(3);
    expect(c.simulated).toBe(true);
  });
});

describe("loan-app checkpoint", () => {
  it("recognises a regulated lender", () => {
    expect(checkLender("emi@bajajfin").registered).toBe(true);
  });
  it("flags an unregistered loan app with the harassment reason", () => {
    const r = checkLender("quickcash-loans@ybl");
    expect(r.registered).toBe(false);
    expect(r.reason).toMatch(/not on the RBI-regulated list/);
  });
  it("a payment to the loan app is stopped and named as loan-app harassment", () => {
    let s = reduce(seed(T0), { type: "pay.select", payload: { payeeId: "loanapp" } }, T0);
    s = reduce(s, { type: "pay.review", payload: { amount: 3_000, signals: { hesitationIndex: 0 } } }, T0);
    expect(s.payment.stage).toBe("stopped");
    expect(s.lenderCheck?.registered).toBe(false);
    expect(s.payment.interview?.classification?.scam).toBe("loan_app");
  });
});

describe("guided booking agent", () => {
  it("pays within the limit without asking", () => {
    let a = startAgent("cheap");
    let d: "pay" | "ask_guardian" | null = null;
    for (let i = 0; i < 3; i++) ({ state: a, decision: d } = nextAgentStep(a));
    expect(a.step).toBe("paid");
    expect(d).toBe("pay");
    expect(a.trip!.price).toBeLessThanOrEqual(AGENT_LIMIT);
  });
  it("asks the guardian above the limit, through the store", () => {
    let s = reduce(seed(T0), { type: "agent.start", payload: { trip: "expensive" } }, T0);
    for (let i = 0; i < 3; i++) s = reduce(s, { type: "agent.next" }, T0);
    expect(s.agent.step).toBe("ask_guardian");
    expect(s.payment.stage).toBe("cosign");
    expect(s.guardian.requests.at(-1)?.amount).toBe(4_600);
  });
  it("pays within the limit, through the store, and debits the balance", () => {
    let s = reduce(seed(T0), { type: "agent.start", payload: { trip: "cheap" } }, T0);
    for (let i = 0; i < 3; i++) s = reduce(s, { type: "agent.next" }, T0);
    expect(s.payment.stage).toBe("success");
    expect(s.user.balance).toBe(84_320 - 1_240);
  });
});
