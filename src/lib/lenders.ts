/**
 * Predatory loan-app checkpoint (REQ-019). SIMULATED registry standing in for RBI's list of
 * regulated entities and their approved digital lending apps. Names are illustrative.
 */
export interface Lender {
  name: string;
  vpaHint: string;
  regulator: "RBI (NBFC)" | "RBI (Bank)";
}

export const REGULATED_LENDERS: Lender[] = [
  { name: "Fed Bank", vpaHint: "fedbank", regulator: "RBI (Bank)" },
  { name: "Bajaj Finance", vpaHint: "bajajfin", regulator: "RBI (NBFC)" },
  { name: "Muthoot Finance", vpaHint: "muthoot", regulator: "RBI (NBFC)" },
  { name: "HDFC Bank", vpaHint: "hdfcbank", regulator: "RBI (Bank)" },
  { name: "KreditBee (Krazybee Services)", vpaHint: "kreditbee", regulator: "RBI (NBFC)" },
];

export interface LenderCheck {
  registered: boolean;
  lender: Lender | null;
  reason: string;
  simulated: true;
}

export function checkLender(nameOrVpa: string): LenderCheck {
  const key = nameOrVpa.toLowerCase();
  const hit = REGULATED_LENDERS.find((l) => key.includes(l.vpaHint) || key.includes(l.name.toLowerCase()));
  if (hit) return { registered: true, lender: hit, reason: `${hit.name} is a regulated lender (${hit.regulator}).`, simulated: true };
  return {
    registered: false,
    lender: null,
    reason: "This lender is not on the RBI-regulated list. Apps like this are known for illegal interest and harassment of borrowers' contacts.",
    simulated: true,
  };
}
