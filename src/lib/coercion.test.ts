import { describe, expect, it } from "vitest";
import { scoreCoercion, tierFor } from "./coercion";

const calm = { callActive: false, remoteApp: null, newPayee: false, pastedVpa: false, appSwitches: 0, hesitationIndex: 0.1 };

describe("coercion: score and tiers", () => {
  it("an ordinary payment to a known payee is allowed with a low score", () => {
    const r = scoreCoercion(calm);
    expect(r.tier).toBe("allow");
    expect(r.score).toBeLessThan(25);
  });

  it("a coached payment (call, new pasted payee, app switching, hesitation) is held for interview", () => {
    const r = scoreCoercion({ ...calm, callActive: true, newPayee: true, pastedVpa: true, appSwitches: 3, hesitationIndex: 0.6 });
    expect(r.tier).toBe("hold");
    expect(r.score).toBeGreaterThanOrEqual(50);
    expect(r.score).toBeLessThan(80);
  });

  it("adding a remote-access app pushes it to a hard stop", () => {
    const r = scoreCoercion({ callActive: true, remoteApp: "AnyDesk", newPayee: true, pastedVpa: true, appSwitches: 3, hesitationIndex: 0.6 });
    expect(r.tier).toBe("stop");
  });

  it("breakdown sums to the score and every contribution is bounded", () => {
    const r = scoreCoercion({ ...calm, callActive: true, hesitationIndex: 2 });
    expect(r.breakdown.reduce((a, b) => a + b.points, 0)).toBe(r.score);
    for (const b of r.breakdown) expect(b.points).toBeLessThanOrEqual(b.max);
  });

  it("a negative threshold shift (failed rehearsal) intervenes earlier", () => {
    expect(tierFor(45, 0)).toBe("check");
    expect(tierFor(45, -10)).toBe("hold");
  });
});
