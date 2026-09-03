import { describe, expect, it } from "vitest";
import { attestationLine } from "./attestation";
import { detectCampaign, isImmune, publishImmunity, recordSignature, CAMPAIGN_MIN_COUNT } from "./immunity";
import type { State } from "./types";

const empty: State["network"] = { immune: [], signatures: [], campaign: null, reputation: {} };

describe("attestation", () => {
  it("an unattested authority claim is called out in plain words", () => {
    const r = attestationLine("+91 11 2345 6789", "police unit");
    expect(r.attested).toBe(false);
    expect(r.line).toMatch(/not who they say they are/);
  });
  it("the real bank's attested call shows its code", () => {
    const r = attestationLine("+91 80 4000 1234", null);
    expect(r.attested).toBe(true);
    expect(r.code).toBe("7Q2M");
  });
});

describe("immunity", () => {
  it("publishes mule VPAs once and skips cash/p2p pseudo-VPAs", () => {
    const n1 = publishImmunity(empty, ["a@okbank", "cash", "p2p", "a@okbank"], "INC-1", 1000);
    expect(n1.immune).toHaveLength(1);
    expect(isImmune(n1, "A@OKBANK")?.incidentId).toBe("INC-1");
    expect(empty.immune).toHaveLength(0);
  });

  it("detects a campaign only past the window threshold", () => {
    let n = empty;
    for (let i = 0; i < CAMPAIGN_MIN_COUNT - 1; i++) n = recordSignature(n, "AUT-BLO-DEM-ISO-THR/abc", "digital_arrest", i);
    expect(detectCampaign(n, "Digital arrest")).toBeNull();
    n = recordSignature(n, "AUT-BLO-DEM-ISO-THR/abc", "digital_arrest", 999);
    expect(detectCampaign(n, "Digital arrest")?.count).toBe(CAMPAIGN_MIN_COUNT);
  });
});
