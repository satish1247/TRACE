/**
 * Guided booking agent (REQ-020). SIMULATED: a scripted state machine showing how an agent
 * books and pays for a senior within a spending limit she set, and hands the decision to her
 * safety circle when the price exceeds it. No real site is contacted.
 */
export type AgentStep = "idle" | "find_official" | "fill" | "price" | "paid" | "ask_guardian";

export interface AgentTrip {
  key: "cheap" | "expensive";
  label: string;
  from: string;
  to: string;
  date: string;
  price: number;
  site: string;
}

export const AGENT_TRIPS: Record<AgentTrip["key"], AgentTrip> = {
  cheap: { key: "cheap", label: "Chennai → Madurai, 12 Sept, sleeper", from: "Chennai Egmore", to: "Madurai", date: "12 Sept", price: 1_240, site: "irctc.co.in (verified official)" },
  expensive: { key: "expensive", label: "Chennai → Delhi, 12 Sept, 2AC", from: "Chennai Central", to: "New Delhi", date: "12 Sept", price: 4_600, site: "irctc.co.in (verified official)" },
};

export const AGENT_LIMIT = 2_000;

export interface AgentState {
  active: boolean;
  step: AgentStep;
  trip: AgentTrip | null;
  limit: number;
  log: string[];
}

export function emptyAgent(): AgentState {
  return { active: false, step: "idle", trip: null, limit: AGENT_LIMIT, log: [] };
}

export function startAgent(key: AgentTrip["key"]): AgentState {
  const trip = AGENT_TRIPS[key];
  return { active: true, step: "find_official", trip, limit: AGENT_LIMIT, log: [`Looking for the official site for ${trip.from} to ${trip.to}.`] };
}

/** Advance one step. At the price step the caller must act on the decision. */
export function nextAgentStep(a: AgentState): { state: AgentState; decision: "pay" | "ask_guardian" | null } {
  if (!a.active || !a.trip) return { state: a, decision: null };
  const price = a.trip.price.toLocaleString("en-IN");
  const limit = a.limit.toLocaleString("en-IN");
  switch (a.step) {
    case "find_official":
      return { state: { ...a, step: "fill", log: [...a.log, `Found ${a.trip.site}. Ignored 3 look-alike sites in the search results.`] }, decision: null };
    case "fill":
      return { state: { ...a, step: "price", log: [...a.log, `Filled passenger details for ${a.trip.date}. Fare ₹${price}.`] }, decision: null };
    case "price":
      if (a.trip.price <= a.limit) {
        return { state: { ...a, step: "paid", active: false, log: [...a.log, `₹${price} is within your ₹${limit} limit. Paid.`] }, decision: "pay" };
      }
      return { state: { ...a, step: "ask_guardian", active: false, log: [...a.log, `₹${price} is above your ₹${limit} limit. Asking Priya before paying.`] }, decision: "ask_guardian" };
    default:
      return { state: a, decision: null };
  }
}
