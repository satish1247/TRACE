/**
 * Pure lookup against a small hardcoded "attested calls" registry (S8).
 *
 * SIMULATED DEMO DATA: in a real deployment this would be a registry a real
 * police unit / bank / courier company populates and signs; for this
 * hackathon demo it is a fixed in-memory array so the "unattested authority
 * claim" path is honestly reproducible without a backend.
 */
import type { AttestationResult, MarkerId } from "./types";

interface AttestedRecord {
  /** matches `Call.callerId` */
  callerId: string;
  authority: string;
}

/** SIMULATED demo data — not a real attestation registry. */
const ATTESTED_RECORDS: readonly AttestedRecord[] = [
  { callerId: "demo-attested-cbi-01", authority: "CBI Cybercrime Cell (demo)" },
  { callerId: "demo-attested-bank-01", authority: "Federal Bank Fraud Desk (demo)" },
];

/** A caller id that resolves as attested, for the UI's "simulate an
 * attested caller" demo toggle. SIMULATED demo data, not a real id. */
export const DEMO_ATTESTED_CALLER_ID = "demo-attested-cbi-01";

const UNATTESTED_MESSAGE = "No police unit has attested a call to you.";

/**
 * Check whether an authority claim on this call matches a known-attested
 * record. Only meaningful once the `authority` marker has fired — before
 * that there is no authority claim to attest.
 */
export function checkAttestation(
  callerId: string,
  markers: readonly MarkerId[],
): AttestationResult {
  const hasAuthorityClaim = markers.includes("authority");
  if (!hasAuthorityClaim) {
    return { attested: true, message: "No authority claim detected on this call yet." };
  }

  const record = ATTESTED_RECORDS.find((r) => r.callerId === callerId);
  if (record) {
    return {
      attested: true,
      message: `This call is attested by ${record.authority} (SIMULATED demo record).`,
    };
  }

  return { attested: false, message: UNATTESTED_MESSAGE };
}
