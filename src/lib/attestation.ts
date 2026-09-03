/**
 * Caller Attestation. Nobody is the police unless the police told TRACE first.
 * Institutions attest a call through the customer's app before it rings; an unattested
 * authority claim on an active call is fraud by definition.
 */
export interface Attestation {
  institution: string;
  callerId: string;
  code: string;
  purpose: string;
  simulated: true;
}

const REGISTRY: Attestation[] = [
  { institution: "Fed Bank", callerId: "+91 80 4000 1234", code: "7Q2M", purpose: "Fixed deposit renewal", simulated: true },
];

export function findAttestation(callerId: string): Attestation | null {
  return REGISTRY.find((a) => a.callerId === callerId) ?? null;
}

export function attestationLine(callerId: string, claimsAuthority: string | null): { attested: boolean; code: string | null; line: string | null } {
  const a = findAttestation(callerId);
  if (a) return { attested: true, code: a.code, line: `Attested by ${a.institution}. Code ${a.code}. Purpose: ${a.purpose}.` };
  if (claimsAuthority)
    return {
      attested: false,
      code: null,
      line: `No ${claimsAuthority} has attested a call to you. This caller is not who they say they are.`,
    };
  return { attested: false, code: null, line: null };
}
