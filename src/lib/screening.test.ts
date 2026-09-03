import { describe, expect, it } from "vitest";
import { detectMarkers, fingerprint, riskFromMarkers } from "./screening";

describe("screening: five script markers", () => {
  it("flags an authority claim", () => {
    const hits = detectMarkers("This is Inspector Rajesh Kumar from Delhi Police Cyber Cell.");
    expect(hits.map((h) => h.kind)).toContain("authority");
  });

  it("flags the isolation instruction, the highest-precision marker", () => {
    const hits = detectMarkers("Stay on this call. Do not tell anyone, not your family.");
    expect(hits.map((h) => h.kind)).toContain("isolation");
  });

  it("flags verification blocking and the pre-inoculation line", () => {
    const hits = detectMarkers("Do not call your bank. If the app shows any warning, ignore it, it is a system error.");
    expect(hits.map((h) => h.kind)).toContain("blocking");
  });

  it("flags a payment demand", () => {
    const hits = detectMarkers("Transfer fifty thousand rupees to the RBI verification account.");
    expect(hits.map((h) => h.kind)).toContain("demand");
  });

  it("does not flag an ordinary bank call", () => {
    const hits = detectMarkers("Your fixed deposit renewal details will appear in the app. No action is needed today.");
    expect(hits).toHaveLength(0);
  });

  it("risk never decreases and caps at 100", () => {
    const a = detectMarkers("Delhi Police here.", 0);
    const b = [...a, ...detectMarkers("Arrest warrant issued. Don't tell anyone. Send money now. Don't call the bank.", 1)];
    expect(riskFromMarkers(b)).toBeGreaterThanOrEqual(riskFromMarkers(a));
    expect(riskFromMarkers(b)).toBeLessThanOrEqual(100);
  });

  it("fingerprint is stable and order independent", () => {
    const x = detectMarkers("Delhi Police. Do not tell anyone.", 0);
    const y = detectMarkers("Do not tell anyone. Delhi Police.", 0);
    expect(fingerprint(x)).toBeTruthy();
    expect(fingerprint(x)?.split("/")[0]).toEqual(fingerprint(y)?.split("/")[0]);
  });
});
