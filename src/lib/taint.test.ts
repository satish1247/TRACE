import { describe, expect, it } from "vitest";
import { buildTree, currentBalance, propagateTaint, recoveredTotal, revealHops, FLOOR } from "./taint";

describe("Proportional Freeze", () => {
  const tree = buildTree(50_000, "lakshmi@fedbank", "Lakshmi");
  const byId = Object.fromEntries(tree.map((n) => [n.id, n]));

  it("the scammer account is fully tainted", () => {
    expect(byId.S.taint).toBe(50_000);
  });

  it("the Rs 20 to the tea shop holds Rs 20 and leaves the rest of its Rs 2 lakh free", () => {
    const t = byId.T;
    expect(t.taint).toBe(20);
    expect(t.held).toBe(20);
    // balance 2,00,000 + 20 received - 10 forwarded to a customer = 2,00,010; minus the Rs 20 hold
    expect(currentBalance(t) - t.held).toBe(1_99_990);
  });

  it("the Rs 10 the tea shop's customer received is below the floor: nothing is held", () => {
    const k = byId.K;
    expect(k.taint).toBeLessThan(FLOOR);
    expect(k.held).toBe(0);
  });

  it("a hold never exceeds taint or the account's current balance", () => {
    for (const n of tree) {
      expect(n.held).toBeLessThanOrEqual(n.taint + 1e-9);
      expect(n.held).toBeLessThanOrEqual(currentBalance(n) + 1e-9);
      expect(n.taint).toBeLessThanOrEqual(n.received + 1e-9);
    }
  });

  it("cash-outs are tainted but cannot be held", () => {
    expect(byId.C1.taint).toBeGreaterThan(0);
    expect(byId.C1.held).toBe(0);
  });

  it("recovery counts only revealed holds and grows as hops reveal", () => {
    const h1 = recoveredTotal(revealHops(tree, 1));
    const h2 = recoveredTotal(revealHops(tree, 2));
    const h4 = recoveredTotal(revealHops(tree, 4));
    expect(h1).toBe(0); // scammer account already emptied onward
    expect(h2).toBeGreaterThan(h1);
    expect(h4).toBeGreaterThanOrEqual(h2);
    expect(h4).toBeGreaterThan(30_000);
    expect(h4).toBeLessThan(50_000);
  });

  it("propagateTaint is pure", () => {
    const before = JSON.stringify(tree);
    propagateTaint(tree);
    expect(JSON.stringify(tree)).toBe(before);
  });
});
