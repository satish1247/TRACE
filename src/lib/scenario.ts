import type { CallScenario, CallState, Payee, State, TranscriptLine } from "./types";
import { emptyAgent } from "./agent";

export const DIGITAL_ARREST: TranscriptLine[] = [
  { speaker: "caller", text: "Hello, am I speaking to Lakshmi madam? This is Inspector Rajesh Kumar calling from Delhi Police Cyber Cell." },
  { speaker: "caller", text: "Madam, a case has been registered. Your Aadhaar number was used to open a bank account for money laundering." },
  { speaker: "caller", text: "An arrest warrant has been issued in your name. You will be arrested today unless we verify you." },
  { speaker: "caller", text: "Stay on this call. Do not tell anyone, not your family, not your neighbours. This is a confidential investigation." },
  { speaker: "caller", text: "To prove your innocence, transfer fifty thousand rupees to the RBI verification account. It is fully refundable after verification." },
  { speaker: "caller", text: "Do not call your bank and do not go to the police station. If the app shows any warning, ignore it, it is a system error." },
  { speaker: "caller", text: "Open your banking app now. I will tell you exactly which buttons to press." },
];

export const ATTESTED_BANK: TranscriptLine[] = [
  { speaker: "caller", text: "Namaste Lakshmi ma'am, this is Fed Bank calling about your fixed deposit renewal. Your app should show code 7Q2M for this call." },
  { speaker: "caller", text: "There is no action needed today. The renewal details will appear in your app. Please never share your PIN with anyone, including us." },
];

export const DRILL_COURIER: TranscriptLine[] = [
  { speaker: "caller", text: "Hello, this is BlueDart courier. A parcel in your name has been held at Mumbai customs because it contains illegal items." },
  { speaker: "caller", text: "To release it you must pay a two thousand four hundred rupee penalty now, otherwise the police will be informed. Do not discuss this with anyone." },
];

export const SCENARIOS: Record<CallScenario, { callerId: string; callerName: string; claimsAuthority: string | null; lines: TranscriptLine[]; isDrill: boolean }> = {
  digital_arrest: { callerId: "+91 11 2345 6789", callerName: "Unknown (claims Delhi Police)", claimsAuthority: "police unit", lines: DIGITAL_ARREST, isDrill: false },
  attested_bank: { callerId: "+91 80 4000 1234", callerName: "Fed Bank", claimsAuthority: null, lines: ATTESTED_BANK, isDrill: false },
  drill_courier: { callerId: "+91 22 6789 0123", callerName: "Unknown (claims BlueDart)", claimsAuthority: "courier company", lines: DRILL_COURIER, isDrill: true },
};

export const PAYEES: Payee[] = [
  { id: "kumar", name: "Kumar Stores", vpa: "kumarstores@okaxis", known: true, kind: "merchant" },
  { id: "priya", name: "Priya (daughter)", vpa: "priya.r@okhdfc", known: true, kind: "person" },
  { id: "pharmacy", name: "Apollo Pharmacy", vpa: "apollo.mylapore@ybl", known: true, kind: "merchant" },
  { id: "loanapp", name: "QuickCash Loan EMI", vpa: "quickcash-loans@ybl", known: false, kind: "lender" },
];

export const IRCTC_PAYEE: Payee = { id: "irctc", name: "IRCTC (official)", vpa: "irctc@sbi", known: false, kind: "merchant" };

export const MULE_PAYEE: Payee = { id: "mule", name: "Verification Desk", vpa: "verification-desk@fedbank", known: false };

export const VERIFIED_HELP = [
  { match: /customer ?care|helpline|support|toll ?free|contact/i, name: "Fed Bank Customer Care", number: "1800 425 1199", note: "Printed on the back of your card and inside this app. Never call a number from search results." },
  { match: /phonepe|gpay|google pay|paytm|upi/i, name: "NPCI UPI Helpline", number: "1800 120 1740", note: "Only from the official app's Help screen." },
  { match: /cyber|fraud|scam|police|1930/i, name: "National Cyber Crime Helpline", number: "1930", note: "Government helpline. Report within the first hour for the best chance of recovery." },
];

export function emptyCall(): CallState {
  return {
    active: false,
    scenario: null,
    callerId: "",
    callerName: "",
    claimsAuthority: null,
    attested: false,
    attestationCode: null,
    attestationLine: null,
    transcript: [],
    cursor: 0,
    markers: [],
    risk: 0,
    ended: "none",
    conferenced: false,
    fingerprint: null,
    isDrill: false,
    classification: null,
    mediaCheck: null,
  };
}

export function seed(now: number): State {
  return {
    version: 1,
    beat: 0,
    startedAt: now,
    user: {
      name: "Lakshmi",
      vpa: "lakshmi@fedbank",
      balance: 84_320,
      pin: "4471",
      duressPin: "9999",
      thresholdShift: 0,
      payees: PAYEES,
      guardianName: "Priya",
    },
    call: emptyCall(),
    device: { remoteAccessApp: null, appSwitches: 0 },
    payment: emptyPayment(),
    guardian: { requests: [], joinedCall: false },
    trace: { active: false, incidentId: null, amount: 0, startedAt: null, goldenHourMs: 60 * 60 * 1000, nodes: [], revealedHops: 0, maxHop: 0, holds: [], recovered: 0, confirmed: false },
    network: {
      immune: [],
      // the wider network has already seen this campaign from other users; one more confirmed report tips it
      signatures: [{ fingerprint: "AUT-BLO-DEM-ISO-THR/seed01", scam: "digital_arrest", firstSeen: now - 38 * 60 * 1000, count: 99 }],
      campaign: null,
      reputation: {},
    },
    evidence: null,
    rehearsal: { active: false, lastResult: null, lessons: [] },
    card: { running: false, cursor: 0, feed: [], stats: { tp: 0, fp: 0, fn: 0, tn: 0 }, decision: null },
    agent: emptyAgent(),
    lenderCheck: null,
    events: [{ ts: now, type: "demo.seed", summary: "Demo reset. Every bank, NPCI, police and FIU rail here is simulated." }],
    stagePin: "auto",
  };
}

export function emptyPayment(): State["payment"] {
  return {
    stage: "idle",
    payee: null,
    pasted: false,
    amount: 0,
    signals: null,
    score: 0,
    breakdown: [],
    tier: "allow",
    reason: "",
    receiptRef: null,
    duress: false,
    interview: null,
    decision: null,
    blockedBy: null,
  };
}

export const INTERVIEW_QUESTION = "One minute. In your own words, who is this money for, and why?";
export const INTERVIEW_QUESTION_TA = "ஒரு நிமிடம். உங்கள் சொந்த வார்த்தைகளில் சொல்லுங்கள்: இந்தப் பணம் யாருக்கு, எதற்காக?";
export const INTERVIEW_QUESTION_HI = "एक मिनट। अपने शब्दों में बताइए, यह पैसा किसके लिए है, और क्यों?";
