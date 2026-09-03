import type { MarkerHit, MarkerKind } from "./types";

/**
 * Detects the five social-engineering script markers in a single line of a call.
 * Language-independent in spirit: patterns cover English, Hinglish and Tamil transliterations
 * that appear in real Indian scam scripts. Works on cloned and real voices alike, because it
 * reads what the call is doing, not how the audio was made.
 */
const PATTERNS: Record<MarkerKind, RegExp[]> = {
  authority: [
    /\b(delhi|mumbai|chennai|cyber)?\s*police\b/i,
    /\b(cbi|crime branch|cyber ?cell|trai|rbi|income tax|customs|enforcement directorate|narcotics|ncb|magistrate|court|inspector|officer|commissioner)\b/i,
    /\b(bank (official|manager|officer)|customer care|courier|bluedart|fedex|dhl|electricity board|tneb|bescom)\b/i,
    /\b(main|hum) (police|bank) se (bol|baat)/i,
    /\bnaan police\b/i,
  ],
  threat: [
    /\b(arrest(ed)?|warrant|jail|fir\b|case (has been )?(registered|filed)|legal action|money laundering|penalty)\b/i,
    /\b(aadhaar|pan|sim|account) (number )?(was |has been |is )?(used|misused|linked|involved)/i,
    /\b(disconnect(ed|ion)?|suspend(ed)?|block(ed)?)\b.*\b(account|power|electricity|sim|number|card)\b/i,
    /\b(parcel|package|courier)\b.*\b(drugs|illegal|narcotics|held|seized)\b/i,
    /\b(within|in) (\d+ |the next )?(minutes?|hours?)\b|\btoday itself\b|\blast chance\b/i,
    /\bgiraftaar\b|\bjail (bhej|jayega)/i,
  ],
  isolation: [
    /\b(do ?n[o']?t|never|not) (tell|inform|discuss (this )?with|share (this )?with) (any ?one|anybody|your (family|son|daughter|husband|wife|neighbou?rs?|children)|nobody)/i,
    /\bnot (tell|inform) any ?one\b/i,
    /\b(stay|remain|be) on (the |this )?(call|line|phone)\b/i,
    /\b(do ?n[o']?t|never) (hang up|cut (the )?call|disconnect|end (the )?call)\b/i,
    /\b(confidential|secret|classified) (investigation|matter|case)\b|\bkeep (this|it) (confidential|secret|between us)\b/i,
    /\bkisi ko (mat |na )?bata(na|o|iye)\b|\byaarukkum solla(the|adheenga)\b/i,
    /\b(go to|sit in|be in) (a )?(separate|another|private|closed) room\b|\balone\b.*\broom\b/i,
  ],
  demand: [
    /\b(transfer|send|pay|deposit|remit)\b.*\b(rupees|rs\.?|₹|\d{2,}|thousand|lakh|amount|money)\b/i,
    /\b(verification|security|refundable|processing|penalty|release|clearance) (account|fee|deposit|charge|amount)\b/i,
    /\b(share|tell|read|give) (me |us )?(the |your )?(otp|pin|cvv|code|password)\b/i,
    /\b(install|download|open)\b.*\b(anydesk|teamviewer|quick ?support|screen ?share|remote)\b/i,
    /\bupi\b.*\b(id|number|transfer|pay)\b/i,
    /\b(paisa|paise|rupaye) (bhej|transfer|daal)/i,
  ],
  blocking: [
    /\b(do ?n[o']?t|never|no need to) (call|contact|visit|go to|check with|verify with)\b.*\b(bank|branch|police station|police|anyone|family|1930)\b/i,
    /\b(ignore|dismiss|skip) (the |any |that )?(warning|alert|message|popup|pop-up)\b/i,
    /\b(it'?s|it is|that is|this is) (just |only )?(a )?(system|technical|app|software) (error|glitch|bug|issue)\b/i,
    /\bthere (is|'s) no time\b|\bno time to (verify|check|think)\b/i,
    /\b(app|bank|phone) (will|may) (show|display) (a |some )?(warning|alert|message)\b/i,
    /\bbank (ko|se) (mat |na )?(call|baat|pooch)/i,
  ],
};

export const MARKER_LABEL: Record<MarkerKind, string> = {
  authority: "Authority claim",
  threat: "Manufactured threat",
  isolation: "Isolation instruction",
  demand: "Payment or credential demand",
  blocking: "Verification blocking",
};

/** First hit of each kind carries the full weight; repeats add a little. Isolation and blocking are the highest-precision signals. */
export const MARKER_WEIGHT: Record<MarkerKind, number> = {
  authority: 15,
  threat: 20,
  isolation: 30,
  demand: 20,
  blocking: 25,
};

export const REPEAT_WEIGHT = 3;
export const CONFERENCE_THRESHOLD = 45;

export function detectMarkers(text: string, lineIndex = 0): MarkerHit[] {
  const hits: MarkerHit[] = [];
  (Object.keys(PATTERNS) as MarkerKind[]).forEach((kind) => {
    for (const re of PATTERNS[kind]) {
      const m = re.exec(text);
      if (m) {
        hits.push({ kind, lineIndex, phrase: m[0].trim() });
        break;
      }
    }
  });
  return hits;
}

export function riskFromMarkers(markers: MarkerHit[]): number {
  const seen = new Set<MarkerKind>();
  let risk = 0;
  for (const m of markers) {
    if (seen.has(m.kind)) risk += REPEAT_WEIGHT;
    else {
      seen.add(m.kind);
      risk += MARKER_WEIGHT[m.kind];
    }
  }
  return Math.min(100, risk);
}

/** Order-independent signature of which beats the script hit, plus a short hash of the phrases. */
export function fingerprint(markers: MarkerHit[]): string | null {
  if (markers.length === 0) return null;
  const kinds = Array.from(new Set(markers.map((m) => m.kind))).sort();
  const code = kinds.map((k) => k.slice(0, 3).toUpperCase()).join("-");
  const text = markers.map((m) => m.phrase.toLowerCase()).sort().join("|");
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return `${code}/${h.toString(16).slice(0, 6)}`;
}

export function kindsPresent(markers: MarkerHit[]): MarkerKind[] {
  return Array.from(new Set(markers.map((m) => m.kind)));
}
