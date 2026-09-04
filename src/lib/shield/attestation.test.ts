import { describe, expect, it } from "vitest";
import { checkAttestation } from "./attestation";

describe("checkAttestation", () => {
  it("returns the unattested message for an authority claim with no matching record (S8)", () => {
    const result = checkAttestation("unknown-caller-id", ["authority"]);
    expect(result.attested).toBe(false);
    expect(result.message).toBe("No police unit has attested a call to you.");
  });

  it("returns attested for a caller id matching a simulated attested record", () => {
    const result = checkAttestation("demo-attested-cbi-01", ["authority"]);
    expect(result.attested).toBe(true);
  });

  it("does not claim unattested status when no authority marker has fired yet", () => {
    const result = checkAttestation("unknown-caller-id", []);
    expect(result.attested).toBe(true);
  });
});
