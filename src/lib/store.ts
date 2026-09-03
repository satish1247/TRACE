import type { Action, Beat, CosignRequest, EvidencePack, Event, Payee, PaymentStage, Role, ScoredTx, Signals, State, TraceNode } from "./types";
import { emptyCall, emptyPayment, INTERVIEW_QUESTION, IRCTC_PAYEE, MULE_PAYEE, SCENARIOS, seed, VERIFIED_HELP } from "./scenario";
import { CARD_MODEL, scoreCard } from "./cardModel";
import { mediaCheckFor, type MediaSampleKey } from "./media";
import { checkLender } from "./lenders";
import { nextAgentStep, startAgent } from "./agent";
import { persist, persistenceMode, restore } from "./persist";
import { detectMarkers, fingerprint, riskFromMarkers, kindsPresent, CONFERENCE_THRESHOLD } from "./screening";
import { classifyNarrative, SCAM_LABELS } from "./taxonomy";
import { scoreCoercion } from "./coercion";
import { attestationLine } from "./attestation";
import { buildTree, maxHop, recoveredTotal, revealHops } from "./taint";
import { detectCampaign, isImmune, publishImmunity, recordReputation, recordSignature } from "./immunity";

/** Single in-memory store, kept on globalThis so Next's dev-mode module reloads do not wipe it. */
type Store = { state: State };
const g = globalThis as unknown as { __trace?: Store; __traceRestored?: boolean };
const SHAPE_KEYS: (keyof State)[] = ["card", "agent", "lenderCheck", "network", "trace", "rehearsal"];
// re-seed when a hot reload changed the state shape, so a stale in-memory state never crashes a screen
if (!g.__trace || SHAPE_KEYS.some((k) => !(k in g.__trace!.state))) g.__trace = { state: seed(Date.now()) };
const store = g.__trace;

// Rehydrate once per process from Firestore or the disk snapshot. Non-blocking: the app serves
// the seed immediately and swaps in the saved state the moment it arrives.
if (!g.__traceRestored) {
  g.__traceRestored = true;
  void restore()
    .then((saved) => {
      if (saved && SHAPE_KEYS.every((k) => k in saved)) {
        store.state = { ...saved, version: saved.version + 1 };
        notify(store.state);
        console.log(`[trace] restored saved state (${persistenceMode()}), version ${store.state.version}`);
      }
    })
    .catch(() => {
      /* start fresh */
    });
}

export { persistenceMode };

export function getState(): State {
  return store.state;
}

/** Live subscribers (SSE connections). The reducer notifies them the instant state changes. */
type Listener = (s: State) => void;
const gl = globalThis as unknown as { __traceListeners?: Set<Listener> };
if (!gl.__traceListeners) gl.__traceListeners = new Set();
const listeners = gl.__traceListeners;

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function listenerCount(): number {
  return listeners.size;
}

function notify(s: State): void {
  for (const fn of listeners) {
    try {
      fn(s);
    } catch {
      /* a dead connection must never break a payment */
    }
  }
}

export class ActionError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 409 = 409,
  ) {
    super(message);
  }
}

const PERMISSIONS: Record<string, Role[]> = {
  "demo.reset": ["presenter"],
  "demo.beat": ["presenter"],
  "stage.pin": ["presenter", "stage"],
  "call.start": ["presenter"],
  "call.advance": ["stage", "presenter", "phone"],
  "call.stop": ["presenter", "phone"],
  "call.liveLine": ["stage", "presenter"],
  "call.conference": ["phone"],
  "device.remoteApp": ["presenter"],
  "device.appSwitch": ["phone", "presenter"],
  "pay.select": ["phone", "presenter"],
  "pay.review": ["phone"],
  "pay.check": ["phone"],
  "pay.pin": ["phone"],
  "pay.cancel": ["phone"],
  "interview.answer": ["phone"],
  "cosign.decide": ["guardian"],
  "trace.start": ["presenter"],
  "trace.advance": ["presenter", "stage"],
  "incident.confirm": ["presenter", "stage"],
  "drill.start": ["presenter"],
  "drill.choose": ["phone"],
  "search.query": ["phone"],
  "card.start": ["presenter", "stage"],
  "card.tick": ["stage", "presenter"],
  "card.stop": ["presenter", "stage"],
  "card.decide": ["phone"],
  "media.check": ["presenter", "stage"],
  "agent.start": ["phone", "presenter"],
  "agent.next": ["phone", "stage", "presenter"],
  "interview.warm": ["phone", "presenter", "stage"],
};

export function dispatch(action: Action, role: Role): State {
  const allowed = PERMISSIONS[action.type];
  if (!allowed) throw new ActionError(`Unknown action ${action.type}`, 400);
  if (!allowed.includes(role)) throw new ActionError(`${role} may not ${action.type}`, 403);
  const now = Date.now();
  const next = reduce(store.state, action, now);
  store.state = { ...next, version: store.state.version + 1 };
  notify(store.state);
  void persist(store.state);
  return store.state;
}

function withEvent(s: State, type: string, summary: string, now: number): State {
  const ev: Event = { ts: now, type, summary };
  return { ...s, events: [...s.events, ev].slice(-200) };
}

function str(p: Record<string, unknown> | undefined, k: string): string {
  const v = p?.[k];
  return typeof v === "string" ? v : "";
}
function num(p: Record<string, unknown> | undefined, k: string): number {
  const v = p?.[k];
  return typeof v === "number" && Number.isFinite(v) ? v : NaN;
}

function ref(now: number): string {
  return `TRC-${(now % 100000).toString().padStart(5, "0")}`;
}

// --------------------------------------------------------------------------- reducer

export function reduce(s: State, a: Action, now: number): State {
  const p = a.payload;
  switch (a.type) {
    case "demo.reset":
      return seed(now);

    case "demo.beat":
      return applyBeat(s, num(p, "beat") as Beat, now);

    case "stage.pin": {
      const pin = str(p, "tab") as State["stagePin"];
      return { ...s, stagePin: pin || "auto" };
    }

    case "call.start": {
      const key = (str(p, "scenario") || "digital_arrest") as keyof typeof SCENARIOS;
      const sc = SCENARIOS[key];
      if (!sc) throw new ActionError("unknown scenario", 400);
      const att = attestationLine(sc.callerId, sc.claimsAuthority);
      const call = {
        ...emptyCall(),
        active: true,
        scenario: key,
        callerId: sc.callerId,
        callerName: sc.callerName,
        claimsAuthority: sc.claimsAuthority,
        attested: att.attested,
        attestationCode: att.code,
        attestationLine: att.line,
        isDrill: sc.isDrill,
      };
      const rep = s.network.reputation[sc.callerId];
      const next = withEvent(
        { ...s, call, guardian: { ...s.guardian, joinedCall: false } },
        "call.start",
        `Incoming call from ${sc.callerName}${rep?.flagged ? " (number already flagged on the network)" : ""}`,
        now,
      );
      return advanceCall(next, now);
    }

    case "call.advance":
      return advanceCall(s, now);

    case "call.liveLine": {
      const text = str(p, "text").trim();
      if (!text || !s.call.active) return s;
      return scoreLine(s, { speaker: "caller", text }, now, true);
    }

    case "call.stop": {
      if (!s.call.active) return s;
      return withEvent({ ...s, call: { ...s.call, active: false, ended: "user_end" } }, "call.stop", "Call ended by Lakshmi", now);
    }

    case "call.conference": {
      if (!s.call.active) throw new ActionError("no active call");
      const line = { speaker: "system" as const, text: `${s.user.guardianName} joined the call.` };
      const bye = { speaker: "system" as const, text: "[caller disconnected]" };
      const call = { ...s.call, conferenced: true, active: false, ended: "scammer_hangup" as const, transcript: [...s.call.transcript, line, bye] };
      return withEvent(
        { ...s, call, guardian: { ...s.guardian, joinedCall: true } },
        "call.conference",
        `${s.user.guardianName} was conferenced in; the caller hung up immediately`,
        now,
      );
    }

    case "device.remoteApp": {
      const app = str(p, "app") || null;
      return withEvent({ ...s, device: { ...s.device, remoteAccessApp: app } }, "device.remoteApp", app ? `${app} detected on the device` : "Remote-access app closed", now);
    }

    case "device.appSwitch":
      return { ...s, device: { ...s.device, appSwitches: s.device.appSwitches + 1 } };

    case "pay.select": {
      const id = str(p, "payeeId");
      const vpa = str(p, "vpa");
      let payee: Payee | null = null;
      let pasted = false;
      if (id) payee = s.user.payees.find((x) => x.id === id) ?? (id === MULE_PAYEE.id ? MULE_PAYEE : null);
      else if (vpa) {
        payee = { id: `new:${vpa}`, name: vpa.split("@")[0], vpa, known: false };
        pasted = Boolean(p?.pasted);
      }
      if (!payee) throw new ActionError("unknown payee", 400);
      if (id === MULE_PAYEE.id) pasted = true;
      return { ...s, payment: { ...emptyPayment(), stage: "composing", payee, pasted } };
    }

    case "pay.review": {
      if (!s.payment.payee) throw new ActionError("select a payee first");
      const amount = num(p, "amount");
      if (!(amount > 0) || amount > s.user.balance) throw new ActionError("amount must be positive and within balance", 400);
      const sig = p?.signals as Partial<Signals> | undefined;
      const signals: Signals = {
        callActive: s.call.active,
        remoteApp: s.device.remoteAccessApp,
        newPayee: !s.payment.payee.known,
        pastedVpa: s.payment.pasted,
        appSwitches: s.device.appSwitches,
        hesitationIndex: typeof sig?.hesitationIndex === "number" ? sig.hesitationIndex : 0,
      };
      const immune = isImmune(s.network, s.payment.payee.vpa);
      if (immune) {
        return withEvent(
          { ...s, payment: { ...s.payment, amount, signals, stage: "blocked", blockedBy: immune, reason: "Payee account is on the network immunity list" } },
          "pay.blocked",
          `Payment of ₹${amount.toLocaleString("en-IN")} to ${s.payment.payee.vpa} blocked before it started: reported by another user`,
          now,
        );
      }
      const boost = s.network.campaign?.thresholdBoost ?? 0;
      const scored = scoreCoercion(signals, s.user.thresholdShift + boost);
      const lenderCheck = s.payment.payee.kind === "lender" ? checkLender(s.payment.payee.vpa) : null;
      if (lenderCheck && !lenderCheck.registered) {
        const classification = classifyNarrative("instant loan app harassment interest repay overdue threaten contacts");
        const payment = {
          ...s.payment,
          amount,
          signals,
          score: scored.score,
          breakdown: scored.breakdown,
          tier: "stop" as const,
          stage: "stopped" as const,
          reason: lenderCheck.reason,
          interview: { question: INTERVIEW_QUESTION, answer: null, classification },
          duress: false,
        };
        return raiseCosign(
          withEvent({ ...s, payment, lenderCheck }, "pay.lender", `Loan-app payment stopped: ${s.payment.payee.name} is not an RBI-regulated lender (simulated registry)`, now),
          now,
        );
      }
      const { score, breakdown, tier } = scored;
      const stage: PaymentStage = tier === "allow" ? "pin" : tier === "check" ? "softcheck" : tier === "hold" ? "interview" : "stopped";
      const fromCall = s.call.classification ?? (s.call.transcript.length ? classifyNarrative(s.call.transcript.map((l) => l.text).join(" ")) : null);
      const interview =
        tier === "hold"
          ? { question: INTERVIEW_QUESTION, answer: null, classification: null }
          : tier === "stop"
            ? { question: INTERVIEW_QUESTION, answer: null, classification: fromCall }
            : null;
      const payment = { ...s.payment, amount, signals, score, breakdown, tier, stage, interview, reason: tierReason(tier), duress: false };
      let next = withEvent({ ...s, payment, lenderCheck }, "pay.review", `₹${amount.toLocaleString("en-IN")} to ${s.payment.payee.name}: coercion ${score}/100, tier ${tier}`, now);
      if (tier === "stop") next = raiseCosign(next, now);
      return next;
    }

    case "pay.check": {
      if (s.payment.stage !== "softcheck") throw new ActionError("not in soft check");
      const known = Boolean(p?.knownBefore);
      if (known) return { ...s, payment: { ...s.payment, stage: "pin" } };
      return withEvent(
        { ...s, payment: { ...s.payment, stage: "interview", tier: "hold", interview: { question: INTERVIEW_QUESTION, answer: null, classification: null } } },
        "pay.escalate",
        "Soft check escalated to interview",
        now,
      );
    }

    case "pay.pin": {
      if (s.payment.stage !== "pin") throw new ActionError("not at PIN");
      const pin = str(p, "pin");
      if (pin === s.user.duressPin) {
        const receipt = ref(now);
        const next = withEvent(
          { ...s, payment: { ...s.payment, stage: "verifying", duress: true, receiptRef: receipt, tier: "hold", interview: { question: INTERVIEW_QUESTION, answer: null, classification: null } } },
          "pay.duress",
          `Duress PIN used. Receipt ${receipt} shown; funds held; ${s.user.guardianName} alerted`,
          now,
        );
        return raiseCosign(next, now);
      }
      if (pin !== s.user.pin) throw new ActionError("PIN did not match", 400);
      return completePayment(s, now);
    }

    case "pay.cancel":
      return withEvent({ ...s, payment: emptyPayment() }, "pay.cancel", "Payment cancelled by Lakshmi", now);

    case "interview.answer": {
      if (!s.payment.interview) throw new ActionError("no interview open");
      const text = str(p, "text").trim();
      if (!text) throw new ActionError("Say or type a few words", 400);
      const classification = classifyNarrative(text);
      const interview = { ...s.payment.interview, answer: text, classification };
      const next = withEvent(
        { ...s, payment: { ...s.payment, interview, stage: "cosign" } },
        "interview.answer",
        `Lakshmi's answer matched: ${classification.label} (${Math.round(classification.confidence * 100)}%)`,
        now,
      );
      return raiseCosign(next, now);
    }

    case "interview.warm": {
      const text = str(p, "text").trim();
      const c = s.payment.interview?.classification;
      if (!text || !c) return s;
      const classification = { ...c, rebuttalWarm: text };
      const requests = s.guardian.requests.map((r) => (r.decision ? r : { ...r, classification }));
      return { ...s, payment: { ...s.payment, interview: { ...s.payment.interview!, classification } }, guardian: { ...s.guardian, requests } };
    }

    case "cosign.decide": {
      const id = str(p, "id");
      const decision = str(p, "decision") as "approve" | "veto";
      const req = s.guardian.requests.find((r) => r.id === id);
      if (!req || req.decision) throw new ActionError("no open request");
      if (decision !== "approve" && decision !== "veto") throw new ActionError("decision must be approve or veto", 400);
      const requests = s.guardian.requests.map((r) => (r.id === id ? { ...r, decision } : r));
      const base = { ...s, guardian: { ...s.guardian, requests } };
      if (decision === "veto") {
        return withEvent({ ...base, payment: { ...s.payment, stage: "vetoed", decision } }, "cosign.veto", `${s.user.guardianName} stopped the payment. Money untouched.`, now);
      }
      return completePayment(withEvent({ ...base, payment: { ...s.payment, decision } }, "cosign.approve", `${s.user.guardianName} approved the payment`, now), now);
    }

    case "trace.start": {
      const amount = num(p, "amount") || 50_000;
      const nodes = revealHops(buildTree(amount, s.user.vpa, s.user.name), 1);
      const trace = {
        ...s.trace,
        active: true,
        incidentId: `INC-${(now % 100000).toString().padStart(5, "0")}`,
        amount,
        startedAt: now,
        nodes,
        revealedHops: 1,
        maxHop: maxHop(nodes),
        holds: [],
        recovered: 0,
        confirmed: false,
      };
      return withEvent({ ...s, trace, call: { ...s.call, active: false } }, "trace.start", `Counterfactual: ₹${amount.toLocaleString("en-IN")} left Lakshmi's account. Golden hour started.`, now);
    }

    case "trace.advance": {
      if (!s.trace.active || s.trace.revealedHops >= s.trace.maxHop) return s;
      const hop = s.trace.revealedHops + 1;
      const nodes = revealHops(s.trace.nodes, hop);
      const newHolds = nodes.filter((n) => n.hop === hop && n.held > 0).map((n) => ({ nodeId: n.id, amount: n.held, placedAt: now, simulated: true as const }));
      const holds = [...s.trace.holds, ...newHolds];
      const recovered = recoveredTotal(nodes);
      const summary = newHolds.length
        ? `Hop ${hop}: ${newHolds.length} hold${newHolds.length > 1 ? "s" : ""} placed, ₹${recovered.toLocaleString("en-IN")} recoverable so far`
        : `Hop ${hop}: revealed, nothing holdable at this layer`;
      return withEvent({ ...s, trace: { ...s.trace, nodes, revealedHops: hop, holds, recovered } }, "trace.advance", summary, now);
    }

    case "incident.confirm": {
      if (!s.trace.active) throw new ActionError("nothing to confirm yet");
      if (s.trace.confirmed) return s;
      const scam = s.call.classification?.scam ?? s.payment.interview?.classification?.scam ?? "digital_arrest";
      const label = SCAM_LABELS[scam] ?? "Digital arrest scam";
      const muleVpas = s.trace.nodes.filter((n) => n.kind === "scammer" || n.kind === "mule").map((n) => n.vpa);
      let network = publishImmunity(s.network, muleVpas, s.trace.incidentId ?? "INC", now);
      const fp = s.call.fingerprint ?? "AUT-BLO-DEM-ISO-THR/seed01";
      network = recordSignature(network, fp, scam, now);
      // the seeded signature is what the wider network already saw from other users; this report tips it
      network = recordSignature(network, "AUT-BLO-DEM-ISO-THR/seed01", "digital_arrest", now);
      if (s.call.callerId) network = recordReputation(network, s.call.callerId, now);
      const campaign = detectCampaign(network, label);
      const evidence = buildEvidence(s, scam, now);
      return withEvent(
        { ...s, network: { ...network, campaign }, trace: { ...s.trace, confirmed: true }, evidence },
        "incident.confirm",
        `Incident confirmed by a human. ${muleVpas.length} accounts immune network-wide; NCRP, CFCFRMS and STR drafts generated (simulated)${campaign ? `; campaign detected: ${campaign.count} reports in ${campaign.windowMinutes} min` : ""}`,
        now,
      );
    }

    case "drill.start": {
      if (s.call.active) throw new ActionError("a call is already in progress");
      const sc = SCENARIOS.drill_courier;
      const att = attestationLine(sc.callerId, sc.claimsAuthority);
      let next: State = {
        ...s,
        rehearsal: { ...s.rehearsal, active: true },
        call: { ...emptyCall(), active: true, scenario: "drill_courier", callerId: sc.callerId, callerName: sc.callerName, claimsAuthority: sc.claimsAuthority, attested: false, attestationCode: null, attestationLine: att.line, isDrill: true },
      };
      next = advanceCall(next, now);
      next = advanceCall(next, now);
      return withEvent(next, "drill.start", "Rehearsal call started (Lakshmi does not know it is a drill yet)", now);
    }

    case "drill.choose": {
      if (!s.rehearsal.active) throw new ActionError("no drill running");
      const choice = str(p, "choice") as "comply" | "hangup" | "ask";
      if (!["comply", "hangup", "ask"].includes(choice)) throw new ActionError("choice must be comply, hangup or ask", 400);
      const shift = choice === "comply" ? -5 : 2;
      const lesson =
        choice === "comply"
          ? "That was a rehearsal. A courier company never phones about drugs in a parcel and never takes a penalty by UPI. Next time, TRACE will step in a little earlier for you."
          : choice === "ask"
            ? "That was a rehearsal, and asking Priya was exactly right. A real emergency survives a two-minute phone call; a scam does not."
            : "That was a rehearsal, and hanging up was exactly right. Nobody genuine needs money from you in the next ten minutes.";
      const thresholdShift = Math.max(-20, Math.min(10, s.user.thresholdShift + shift));
      return withEvent(
        {
          ...s,
          rehearsal: { active: false, lastResult: choice, lessons: [...s.rehearsal.lessons, lesson] },
          user: { ...s.user, thresholdShift },
          call: { ...s.call, active: false, ended: "user_end" },
        },
        "drill.result",
        `Rehearsal: ${choice}. Personal threshold shift is now ${thresholdShift}`,
        now,
      );
    }

    case "search.query": {
      const q = str(p, "q");
      const hit = VERIFIED_HELP.find((h) => h.match.test(q));
      return hit ? withEvent(s, "search.intercept", `Search "${q}" intercepted: verified ${hit.name} shown instead of results`, now) : s;
    }

    // ------------------------------------------------------------- card-fraud engine
    case "card.start":
      return withEvent(
        { ...s, card: { ...s.card, running: true } },
        "card.start",
        `Card engine streaming held-out PaySim transactions (${CARD_MODEL.trees.length} trees, ROC-AUC ${CARD_MODEL.metrics.roc_auc.toFixed(3)}, scored in the app runtime)`,
        now,
      );

    case "card.tick": {
      if (!s.card.running) return s;
      const sample = CARD_MODEL.samples[s.card.cursor % CARD_MODEL.samples.length];
      const { prob, flagged, reasons } = scoreCard(sample.tx);
      const verdict: ScoredTx["verdict"] = flagged ? (sample.label === 1 ? "TP" : "FP") : sample.label === 1 ? "FN" : "TN";
      const item: ScoredTx = { id: s.card.cursor, tx: sample.tx, prob, flagged, label: sample.label, verdict, reasons, at: now };
      const k = verdict.toLowerCase() as keyof State["card"]["stats"];
      const stats = { ...s.card.stats, [k]: s.card.stats[k] + 1 };
      const feed = [item, ...s.card.feed].slice(0, 12);
      const next: State = { ...s, card: { ...s.card, cursor: s.card.cursor + 1, feed, stats, decision: flagged ? null : s.card.decision } };
      return flagged
        ? withEvent(next, "card.flag", `Card: ${sample.tx.type} ₹${Math.round(sample.tx.amount).toLocaleString("en-IN")} flagged (p=${prob.toFixed(2)}, ${verdict})`, now)
        : next;
    }

    case "card.stop":
      return { ...s, card: { ...s.card, running: false } };

    case "card.decide": {
      const d = str(p, "decision");
      if (d !== "approve" && d !== "notme") throw new ActionError("decision must be approve or notme", 400);
      return withEvent(
        { ...s, card: { ...s.card, decision: d } },
        "card.decide",
        d === "notme" ? "Lakshmi: 'not me'. Card blocked and the bank's fraud desk alerted (simulated)" : "Lakshmi approved the card payment",
        now,
      );
    }

    // ------------------------------------------------------------- synthetic media (simulated)
    case "media.check": {
      const key = (str(p, "sample") || (s.call.scenario === "attested_bank" ? "genuine_bank" : "real_scammer")) as MediaSampleKey;
      const check = mediaCheckFor(key);
      if (!check) throw new ActionError("unknown sample", 400);
      return withEvent(
        { ...s, call: { ...s.call, mediaCheck: check } },
        "media.check",
        `Audio authenticity (simulated): ${check.label} → ${check.verdict}, ${Math.round(check.authenticity * 100)}% human`,
        now,
      );
    }

    // ------------------------------------------------------------- guided booking agent (simulated)
    case "agent.start": {
      const key = str(p, "trip") === "expensive" ? "expensive" : "cheap";
      const agent = startAgent(key);
      return withEvent({ ...s, agent, payment: emptyPayment() }, "agent.start", `Agent: booking ${agent.trip?.label} within a ₹${agent.limit.toLocaleString("en-IN")} limit`, now);
    }

    case "agent.next": {
      const { state: agent, decision } = nextAgentStep(s.agent);
      if (agent === s.agent) return s;
      const price = agent.trip?.price ?? 0;
      if (decision === "pay" && agent.trip) {
        const next: State = {
          ...s,
          agent,
          user: { ...s.user, balance: s.user.balance - price },
          payment: { ...emptyPayment(), stage: "success", payee: IRCTC_PAYEE, amount: price, receiptRef: ref(now), tier: "allow", reason: "The agent paid within the limit Lakshmi set" },
        };
        return withEvent(next, "agent.paid", `Agent paid ₹${price.toLocaleString("en-IN")} to IRCTC, within the ₹${agent.limit.toLocaleString("en-IN")} limit`, now);
      }
      if (decision === "ask_guardian" && agent.trip) {
        const next: State = { ...s, agent, payment: { ...emptyPayment(), stage: "cosign", payee: IRCTC_PAYEE, amount: price, tier: "hold", reason: "Above the agent's spending limit" } };
        return raiseCosign(withEvent(next, "agent.ask", `Agent: ₹${price.toLocaleString("en-IN")} exceeds the ₹${agent.limit.toLocaleString("en-IN")} limit; asking ${s.user.guardianName}`, now), now);
      }
      return withEvent({ ...s, agent }, "agent.step", agent.log[agent.log.length - 1] ?? "", now);
    }

    default:
      throw new ActionError(`Unknown action ${a.type}`, 400);
  }
}

// --------------------------------------------------------------------------- helpers

function tierReason(tier: State["payment"]["tier"]): string {
  switch (tier) {
    case "allow":
      return "Looks like an ordinary payment.";
    case "check":
      return "A couple of things are unusual; one quick question.";
    case "hold":
      return "Several signs that someone is telling you what to do.";
    case "stop":
      return "This matches a known scam in progress.";
  }
}

function advanceCall(s: State, now: number): State {
  if (!s.call.active || !s.call.scenario) return s;
  const lines = SCENARIOS[s.call.scenario].lines;
  if (s.call.cursor >= lines.length) return s;
  const line = lines[s.call.cursor];
  return scoreLine({ ...s, call: { ...s.call, cursor: s.call.cursor + 1 } }, line, now, false);
}

function scoreLine(s: State, line: { speaker: "caller" | "user" | "system"; text: string }, now: number, live: boolean): State {
  const idx = s.call.transcript.length;
  const hits = line.speaker === "caller" ? detectMarkers(line.text, idx) : [];
  const markers = [...s.call.markers, ...hits];
  const risk = riskFromMarkers(markers);
  const transcript = [...s.call.transcript, line];
  const fp = fingerprint(markers);
  const classification = markers.length ? classifyNarrative(transcript.map((l) => l.text).join(" ")) : s.call.classification;
  let next: State = { ...s, call: { ...s.call, transcript, markers, risk, fingerprint: fp, classification } };
  for (const h of hits) next = withEvent(next, "call.marker", `${live ? "Live" : "Script"} marker: ${h.kind} ("${h.phrase}")`, now);
  if (risk >= CONFERENCE_THRESHOLD && s.call.risk < CONFERENCE_THRESHOLD) next = withEvent(next, "call.risk", `Call risk ${risk}/100: "Add ${s.user.guardianName} to this call" offered`, now);
  return next;
}

function raiseCosign(s: State, now: number): State {
  if (!s.payment.payee) return s;
  const req: CosignRequest = {
    id: `CS-${now % 100000}`,
    createdAt: now,
    amount: s.payment.amount,
    payee: s.payment.payee,
    score: s.payment.score,
    tier: s.payment.tier,
    markers: kindsPresent(s.call.markers),
    answer: s.payment.interview?.answer ?? null,
    classification: s.payment.interview?.classification ?? s.call.classification ?? null,
    duress: s.payment.duress,
    decision: null,
  };
  const open = s.guardian.requests.find((r) => !r.decision);
  if (open) {
    // refresh the open request in place (same id) so the guardian screen keeps its context
    return { ...s, guardian: { ...s.guardian, requests: s.guardian.requests.map((r) => (r.id === open.id ? { ...req, id: r.id, createdAt: r.createdAt } : r)) } };
  }
  return withEvent(
    { ...s, guardian: { ...s.guardian, requests: [...s.guardian.requests, req] } },
    "cosign.request",
    `${s.user.guardianName}'s phone: approve or veto ₹${req.amount.toLocaleString("en-IN")} to ${req.payee.name}`,
    now,
  );
}

function completePayment(s: State, now: number): State {
  if (!s.payment.payee) return s;
  const receipt = s.payment.receiptRef ?? ref(now);
  return withEvent(
    { ...s, user: { ...s.user, balance: s.user.balance - s.payment.amount }, payment: { ...s.payment, stage: "success", receiptRef: receipt } },
    "pay.success",
    `₹${s.payment.amount.toLocaleString("en-IN")} paid to ${s.payment.payee.name}. Ref ${receipt}`,
    now,
  );
}

function buildEvidence(s: State, scam: string, now: number): EvidencePack {
  const holds = s.trace.nodes.filter((n) => n.revealed && n.held > 0).map((n) => ({ vpa: n.vpa, label: n.label, amount: n.held }));
  const immune = s.trace.nodes.filter((n) => n.kind === "scammer" || n.kind === "mule").map((n) => n.vpa);
  const p2p = s.trace.nodes.find((n) => n.vpa === "p2p");
  return {
    incidentId: s.trace.incidentId ?? "INC",
    generatedAt: now,
    victim: { name: s.user.name, vpa: s.user.vpa },
    amount: s.trace.amount,
    scam: SCAM_LABELS[scam] ?? scam,
    timeline: s.events
      .filter((e) => e.type.startsWith("call.") || e.type.startsWith("pay.") || e.type.startsWith("trace."))
      .slice(-12)
      .map((e) => ({ ts: e.ts, summary: e.summary })),
    holds,
    recovered: s.trace.recovered,
    immune,
    ncrp: { portal: "cybercrime.gov.in", helpline: "1930", category: "Impersonation / digital arrest", status: "DRAFT - confirmed by presenter (human in the loop)" },
    cfcfrms: { beneficiaryVpa: "verification-desk@fedbank", amount: s.trace.amount, holdRequested: true, status: "Hold request prepared for beneficiary bank (simulated)" },
    str: {
      reportingEntity: "Fed Bank (simulated)",
      to: "FIU-IND",
      grounds: "Coerced transfer, layered within minutes across mule accounts; script fingerprint matches an active campaign",
      status: "DRAFT",
    },
    ...(p2p
      ? {
          exchangeHold: {
            exchange: "FIU-IND registered VASP (simulated)",
            amount: p2p.received,
            status: "KYC hold request drafted for the off-ramp account; on-chain trace attached",
          },
        }
      : {}),
    simulated: true,
  };
}

// --------------------------------------------------------------------------- beats

function applyBeat(s: State, beat: Beat, now: number): State {
  switch (beat) {
    case 0:
      return seed(now);
    case 1: {
      const base = seed(now);
      return withEvent({ ...base, beat: 1 }, "demo.beat", "Beat 1: Lakshmi pays her regular kirana store. Nothing should fire.", now);
    }
    case 2: {
      const base: State = { ...s, beat: 2, payment: emptyPayment(), device: { remoteAccessApp: null, appSwitches: 0 }, guardian: { ...s.guardian, joinedCall: false } };
      const started = reduce(base, { type: "call.start", payload: { scenario: "digital_arrest" } }, now);
      return withEvent(started, "demo.beat", "Beat 2: the scam call. Watch the five markers, not the voice.", now);
    }
    case 3: {
      let st: State = { ...s, beat: 3, guardian: { ...s.guardian, joinedCall: false } };
      if (!st.call.active || st.call.scenario !== "digital_arrest") st = reduce(st, { type: "call.start", payload: { scenario: "digital_arrest" } }, now);
      for (let i = 0; i < 10; i++) st = advanceCall(st, now);
      st = {
        ...st,
        call: { ...st.call, active: true, ended: "none" },
        device: { remoteAccessApp: null, appSwitches: 3 },
        payment: { ...emptyPayment(), stage: "composing", payee: MULE_PAYEE, pasted: true },
      };
      return withEvent(st, "demo.beat", "Beat 3: she is told to pay ₹50,000. Type the amount slowly, as she would.", now);
    }
    case 4: {
      const st = reduce({ ...s, beat: 4, payment: emptyPayment() }, { type: "trace.start", payload: { amount: 50_000 } }, now);
      return withEvent(st, "demo.beat", "Beat 4: suppose the money had already gone. Race the clock.", now);
    }
    case 5: {
      let st: State = { ...s, beat: 5 };
      if (!st.trace.active) st = reduce(st, { type: "trace.start", payload: { amount: 50_000 } }, now);
      if (!st.trace.confirmed) {
        while (st.trace.revealedHops < st.trace.maxHop) st = reduce(st, { type: "trace.advance" }, now);
        st = reduce(st, { type: "incident.confirm" }, now);
      }
      st = {
        ...st,
        call: { ...st.call, active: false },
        device: { remoteAccessApp: null, appSwitches: 0 },
        payment: { ...emptyPayment(), stage: "composing", payee: MULE_PAYEE, pasted: true },
      };
      return withEvent(st, "demo.beat", "Beat 5: someone else tries to pay the same account. It never starts.", now);
    }
    case 6: {
      let st: State = {
        ...s,
        beat: 6,
        call: { ...s.call, active: false },
        payment: emptyPayment(),
        card: { running: true, cursor: 0, feed: [], stats: { tp: 0, fp: 0, fn: 0, tn: 0 }, decision: null },
      };
      st = reduce(st, { type: "card.tick" }, now);
      return withEvent(st, "demo.beat", "Beat 6: the card-fraud engine scores held-out PaySim transactions live, in the app runtime.", now);
    }
    default:
      throw new ActionError("beat must be 0-6", 400);
  }
}

export type { TraceNode };
