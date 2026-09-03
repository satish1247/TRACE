import { describe, expect, it } from "vitest";
import { reduce } from "./store";
import { seed } from "./scenario";
import type { State } from "./types";

const T0 = 1_700_000_000_000;
const run = (s: State, type: string, payload?: Record<string, unknown>, t = T0) => reduce(s, { type, payload }, t);

describe("store: the five beats end to end", () => {
  it("beat 1: a known payee sails through to success", () => {
    let s = run(seed(T0), "demo.beat", { beat: 1 });
    s = run(s, "pay.select", { payeeId: "kumar" });
    s = run(s, "pay.review", { amount: 340, signals: { hesitationIndex: 0.1 } });
    expect(s.payment.tier).toBe("allow");
    expect(s.payment.stage).toBe("pin");
    s = run(s, "pay.pin", { pin: "4471" });
    expect(s.payment.stage).toBe("success");
    expect(s.user.balance).toBe(84_320 - 340);
  });

  it("beat 2: the scripted call lights all five markers and the attestation line", () => {
    let s = run(seed(T0), "demo.beat", { beat: 2 });
    expect(s.call.active).toBe(true);
    expect(s.call.attestationLine).toMatch(/not who they say they are/);
    for (let i = 0; i < 8; i++) s = run(s, "call.advance");
    const kinds = new Set(s.call.markers.map((m) => m.kind));
    expect(kinds).toEqual(new Set(["authority", "threat", "isolation", "demand", "blocking"]));
    expect(s.call.risk).toBeGreaterThanOrEqual(80);
    expect(s.call.classification?.scam).toBe("digital_arrest");
  });

  it("un-isolate: conferencing the guardian makes the caller hang up", () => {
    let s = run(seed(T0), "demo.beat", { beat: 2 });
    s = run(s, "call.conference");
    expect(s.call.active).toBe(false);
    expect(s.call.ended).toBe("scammer_hangup");
    expect(s.guardian.joinedCall).toBe(true);
  });

  it("beat 3: the coached payment is held, interviewed, named, and vetoed by Priya", () => {
    let s = run(seed(T0), "demo.beat", { beat: 3 });
    expect(s.payment.stage).toBe("composing");
    s = run(s, "pay.review", { amount: 50_000, signals: { hesitationIndex: 0.7 } });
    expect(s.payment.tier).toBe("hold");
    expect(s.payment.stage).toBe("interview");
    s = run(s, "interview.answer", { text: "Police called, my Aadhaar was used in money laundering, I must send verification money or be arrested" });
    expect(s.payment.interview?.classification?.scam).toBe("digital_arrest");
    expect(s.payment.stage).toBe("cosign");
    const req = s.guardian.requests.find((r) => !r.decision);
    expect(req?.amount).toBe(50_000);
    s = run(s, "cosign.decide", { id: req!.id, decision: "veto" });
    expect(s.payment.stage).toBe("vetoed");
    expect(s.user.balance).toBe(84_320);
  });

  it("beat 3 with AnyDesk: hard stop, scam named from the call itself, guardian asked", () => {
    let s = run(seed(T0), "demo.beat", { beat: 3 });
    s = run(s, "device.remoteApp", { app: "AnyDesk" });
    s = run(s, "pay.review", { amount: 50_000, signals: { hesitationIndex: 0.7 } });
    expect(s.payment.tier).toBe("stop");
    expect(s.payment.stage).toBe("stopped");
    expect(s.payment.interview?.classification?.scam).toBe("digital_arrest");
    expect(s.guardian.requests.length).toBe(1);
  });

  it("duress PIN: true receipt, funds held, guardian alerted, interview opens", () => {
    let s = run(seed(T0), "demo.beat", { beat: 1 });
    s = run(s, "pay.select", { payeeId: "kumar" });
    s = run(s, "pay.review", { amount: 5_000, signals: { hesitationIndex: 0 } });
    s = run(s, "pay.pin", { pin: "9999" });
    expect(s.payment.stage).toBe("verifying");
    expect(s.payment.duress).toBe(true);
    expect(s.payment.receiptRef).toMatch(/^TRC-/);
    expect(s.user.balance).toBe(84_320);
    expect(s.guardian.requests[0]?.duress).toBe(true);
  });

  it("beat 4: the tree reveals hop by hop, holds only tainted value, recovers most of the money", () => {
    let s = run(seed(T0), "demo.beat", { beat: 4 });
    expect(s.trace.active).toBe(true);
    expect(s.trace.revealedHops).toBe(1);
    while (s.trace.revealedHops < s.trace.maxHop) s = run(s, "trace.advance");
    const tea = s.trace.nodes.find((n) => n.id === "T")!;
    const customer = s.trace.nodes.find((n) => n.id === "K")!;
    expect(tea.held).toBe(20);
    expect(customer.held).toBe(0);
    expect(s.trace.recovered).toBeGreaterThan(30_000);
  });

  it("beat 5: after confirmation the mule account is blocked before the payment starts, and a campaign is named", () => {
    let s = run(seed(T0), "demo.beat", { beat: 4 });
    s = run(s, "demo.beat", { beat: 5 });
    expect(s.trace.confirmed).toBe(true);
    expect(s.network.immune.length).toBeGreaterThan(5);
    expect(s.network.campaign?.count).toBeGreaterThanOrEqual(100);
    expect(s.evidence?.simulated).toBe(true);
    expect(s.evidence?.exchangeHold?.amount).toBe(5_000);
    s = run(s, "pay.review", { amount: 50_000, signals: { hesitationIndex: 0 } });
    expect(s.payment.stage).toBe("blocked");
    expect(s.payment.blockedBy?.vpa).toBe("verification-desk@fedbank");
  });

  it("rehearsal: complying moves the personal threshold earlier", () => {
    let s = run(seed(T0), "drill.start");
    expect(s.call.isDrill).toBe(true);
    s = run(s, "drill.choose", { choice: "comply" });
    expect(s.user.thresholdShift).toBe(-5);
    expect(s.rehearsal.lessons[0]).toMatch(/rehearsal/i);
  });

  it("illegal transitions throw and leave state untouched", () => {
    const s = seed(T0);
    expect(() => run(s, "pay.pin", { pin: "4471" })).toThrow();
    expect(() => run(s, "cosign.decide", { id: "nope", decision: "veto" })).toThrow();
  });
});
