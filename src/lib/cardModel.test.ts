import { describe, expect, it } from "vitest";
import { CARD_MODEL, featurise, reasonsFor, scoreCard } from "./cardModel";

describe("card-fraud engine (XGBoost trees scored in TypeScript)", () => {
  it("ships a trained model with held-out metrics and parity samples", () => {
    expect(CARD_MODEL.trees.length).toBeGreaterThan(10);
    expect(CARD_MODEL.samples.length).toBe(60);
    expect(CARD_MODEL.metrics.roc_auc).toBeGreaterThan(0.9);
    expect(CARD_MODEL.metrics.recall).toBeGreaterThan(0.7);
    expect(CARD_MODEL.threshold).toBeGreaterThan(0);
    expect(CARD_MODEL.threshold).toBeLessThan(1);
  });

  it("scores every parity sample within 1e-4 of the Python probability", () => {
    let maxDiff = 0;
    for (const s of CARD_MODEL.samples) {
      const { prob } = scoreCard(s.tx);
      maxDiff = Math.max(maxDiff, Math.abs(prob - s.prob));
    }
    expect(maxDiff).toBeLessThan(1e-4);
  });

  it("flags most fraud samples and clears most legitimate ones", () => {
    const fraud = CARD_MODEL.samples.filter((s) => s.label === 1);
    const legit = CARD_MODEL.samples.filter((s) => s.label === 0);
    const tp = fraud.filter((s) => scoreCard(s.tx).flagged).length;
    const tn = legit.filter((s) => !scoreCard(s.tx).flagged).length;
    expect(tp / fraud.length).toBeGreaterThan(0.7);
    expect(tn / legit.length).toBeGreaterThan(0.85);
  });

  it("engineers features exactly as the trainer does", () => {
    const f = featurise({ type: "TRANSFER", amount: 1000, oldbalanceOrg: 1000, newbalanceOrig: 0, oldbalanceDest: 0, newbalanceDest: 0, nameDest: "C123" });
    expect(f.type_TRANSFER).toBe(1);
    expect(f.type_PAYMENT).toBe(0);
    expect(f.errOrig).toBe(0);
    expect(f.errDest).toBe(1000);
    expect(f.destIsMerchant).toBe(0);
    expect(f.drainsAccount).toBe(1);
  });

  it("explains a flagged transaction in plain words", () => {
    const r = reasonsFor({ type: "CASH_OUT", amount: 250_000, oldbalanceOrg: 250_000, newbalanceOrig: 0, oldbalanceDest: 0, newbalanceDest: 0, nameDest: "C9" });
    expect(r.length).toBeGreaterThan(0);
    expect(r.join(" ")).toMatch(/empties/);
  });
});
