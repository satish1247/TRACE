export type Role = "phone" | "guardian" | "stage" | "presenter";
export type Beat = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type MarkerKind = "authority" | "threat" | "isolation" | "demand" | "blocking";

export interface MarkerHit {
  kind: MarkerKind;
  lineIndex: number;
  phrase: string;
}

export interface TranscriptLine {
  speaker: "caller" | "user" | "system";
  text: string;
}

export interface Payee {
  id: string;
  name: string;
  vpa: string;
  known: boolean;
  kind?: "person" | "merchant" | "lender";
}

export interface CardTxLite {
  type: string;
  amount: number;
  oldbalanceOrg: number;
  newbalanceOrig: number;
  oldbalanceDest: number;
  newbalanceDest: number;
  nameDest: string;
}

export interface ScoredTx {
  id: number;
  tx: CardTxLite;
  prob: number;
  flagged: boolean;
  label: 0 | 1;
  verdict: "TP" | "FP" | "FN" | "TN";
  reasons: string[];
  at: number;
}

/** Everything the phone measures locally. Raw timings never leave the device; only the index does. */
export interface Signals {
  callActive: boolean;
  remoteApp: string | null;
  newPayee: boolean;
  pastedVpa: boolean;
  appSwitches: number;
  /** 0..1, from lib/hesitation.ts in the browser */
  hesitationIndex: number;
}

export type Tier = "allow" | "check" | "hold" | "stop";

export interface Breakdown {
  key: keyof Signals;
  label: string;
  points: number;
  max: number;
  note: string;
}

export interface Classification {
  scam: string;
  label: string;
  confidence: number;
  rebuttal: string;
  /** optional warmer wording from the LLM enhancer; never required */
  rebuttalWarm?: string;
  stat: string;
  source: string;
  markers: MarkerKind[];
}

export type PaymentStage =
  | "idle"
  | "composing"
  | "review"
  | "softcheck"
  | "pin"
  | "interview"
  | "cosign"
  | "verifying"
  | "success"
  | "vetoed"
  | "stopped"
  | "blocked";

export interface ImmuneEntry {
  vpa: string;
  reportedAt: number;
  incidentId: string;
  simulated: true;
}

export interface Payment {
  stage: PaymentStage;
  payee: Payee | null;
  pasted: boolean;
  amount: number;
  signals: Signals | null;
  score: number;
  breakdown: Breakdown[];
  tier: Tier;
  reason: string;
  receiptRef: string | null;
  duress: boolean;
  interview: {
    question: string;
    answer: string | null;
    classification: Classification | null;
  } | null;
  decision: "approve" | "veto" | null;
  blockedBy: ImmuneEntry | null;
}

export interface CosignRequest {
  id: string;
  createdAt: number;
  amount: number;
  payee: Payee;
  score: number;
  tier: Tier;
  markers: MarkerKind[];
  answer: string | null;
  classification: Classification | null;
  duress: boolean;
  decision: "approve" | "veto" | null;
}

export type NodeKind = "victim" | "scammer" | "mule" | "merchant" | "individual" | "cashout";

export interface TraceNode {
  id: string;
  hop: number;
  label: string;
  vpa: string;
  kind: NodeKind;
  balanceBefore: number;
  received: number;
  /** money this node sent onward to its children */
  forwarded: number;
  taint: number;
  held: number;
  settlement: boolean;
  parentId: string | null;
  revealed: boolean;
}

export interface Hold {
  nodeId: string;
  amount: number;
  placedAt: number;
  simulated: true;
}

export interface ScriptSignature {
  fingerprint: string;
  scam: string;
  firstSeen: number;
  count: number;
}

export interface Campaign {
  fingerprint: string;
  scam: string;
  label: string;
  count: number;
  windowMinutes: number;
  region: string;
  thresholdBoost: number;
}

export interface Reputation {
  reports: number;
  lastSeen: number;
  flagged: boolean;
}

export type CallScenario = "digital_arrest" | "attested_bank" | "drill_courier";

export interface CallState {
  active: boolean;
  scenario: CallScenario | null;
  callerId: string;
  callerName: string;
  claimsAuthority: string | null;
  attested: boolean;
  attestationCode: string | null;
  attestationLine: string | null;
  transcript: TranscriptLine[];
  cursor: number;
  markers: MarkerHit[];
  risk: number;
  ended: "none" | "scammer_hangup" | "user_end";
  conferenced: boolean;
  fingerprint: string | null;
  isDrill: boolean;
  classification: Classification | null;
  mediaCheck: import("./media").MediaCheck | null;
}

export interface EvidencePack {
  incidentId: string;
  generatedAt: number;
  victim: { name: string; vpa: string };
  amount: number;
  scam: string;
  timeline: { ts: number; summary: string }[];
  holds: { vpa: string; label: string; amount: number }[];
  recovered: number;
  immune: string[];
  ncrp: { portal: string; helpline: string; category: string; status: string };
  cfcfrms: { beneficiaryVpa: string; amount: number; holdRequested: boolean; status: string };
  str: { reportingEntity: string; to: string; grounds: string; status: string };
  /** present when the money tree reached a crypto P2P off-ramp: enforcement happens at the KYC'd exchange */
  exchangeHold?: { exchange: string; amount: number; status: string };
  simulated: true;
}

export interface Event {
  ts: number;
  type: string;
  summary: string;
}

export interface State {
  version: number;
  beat: Beat;
  startedAt: number;
  user: {
    name: string;
    vpa: string;
    balance: number;
    pin: string;
    duressPin: string;
    thresholdShift: number;
    payees: Payee[];
    guardianName: string;
  };
  call: CallState;
  device: { remoteAccessApp: string | null; appSwitches: number };
  payment: Payment;
  guardian: { requests: CosignRequest[]; joinedCall: boolean };
  trace: {
    active: boolean;
    incidentId: string | null;
    amount: number;
    startedAt: number | null;
    goldenHourMs: number;
    nodes: TraceNode[];
    revealedHops: number;
    maxHop: number;
    holds: Hold[];
    recovered: number;
    confirmed: boolean;
  };
  network: {
    immune: ImmuneEntry[];
    signatures: ScriptSignature[];
    campaign: Campaign | null;
    reputation: Record<string, Reputation>;
  };
  evidence: EvidencePack | null;
  rehearsal: { active: boolean; lastResult: "comply" | "hangup" | "ask" | null; lessons: string[] };
  card: {
    running: boolean;
    cursor: number;
    feed: ScoredTx[];
    stats: { tp: number; fp: number; fn: number; tn: number };
    decision: "approve" | "notme" | null;
  };
  agent: import("./agent").AgentState;
  lenderCheck: import("./lenders").LenderCheck | null;
  events: Event[];
  stagePin: "auto" | "call" | "coercion" | "trace" | "network" | "card";
}

export interface Action {
  type: string;
  payload?: Record<string, unknown>;
}
