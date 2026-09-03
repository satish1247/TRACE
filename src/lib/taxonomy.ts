import type { Classification, MarkerKind } from "./types";
import { detectMarkers, kindsPresent } from "./screening";

interface ScamDef {
  scam: string;
  label: string;
  keywords: [RegExp, number][];
  rebuttal: string;
  stat: string;
  source: string;
}

/** Sourced figures only. Where a scam has no specific verified figure, the national figure is used and says so. */
const NATIONAL_STAT = "I4C projected India's cyber-fraud losses at ₹1.2 lakh crore for 2025, about 0.7% of GDP.";
const NATIONAL_SOURCE = "I4C projection, reported May 2026";

const DEFS: ScamDef[] = [
  {
    scam: "digital_arrest",
    label: "Digital arrest scam",
    keywords: [
      [/\b(police|cbi|cyber ?cell|crime branch|inspector|officer|narcotics|ncb|customs)\b/i, 3],
      [/\b(arrest|warrant|case|jail|fir|money laundering|laundering)\b/i, 3],
      [/\b(aadhaar|pan|sim)\b.*\b(used|misused|case|crime)\b/i, 3],
      [/\b(verification|verify|prove|innocent|innocence|clear (my|your) name)\b/i, 2],
      [/\b(video call|skype|whatsapp call|stay on)\b/i, 1],
      [/\b(court|magistrate|judge|supreme court)\b/i, 2],
    ],
    rebuttal:
      "No police force, court or CBI office in India ever collects money by UPI, and no one is 'digitally arrested' over a phone call. This is the digital-arrest scam. Your money is safe. We have not sent it.",
    stat: "15,215 digital-arrest complaints were filed in the first five months of 2026 alone; ₹4,057 crore was lost to it between 2022 and May 2026.",
    source: "I4C data, 2022 to May 2026",
  },
  {
    scam: "kyc_update",
    label: "KYC update / account block scam",
    keywords: [
      [/\bkyc\b/i, 4],
      [/\b(update|expire|expired|expiry|re-?verify|pending)\b/i, 2],
      [/\b(account|sim|card|number)\b.*\b(block|blocked|suspend|suspended|deactivat)/i, 3],
      [/\b(link|click|download|app|apk)\b/i, 1],
      [/\b(bank|sbi|hdfc|icici|axis|fed bank)\b.*\b(called|calling|message|sms)\b/i, 2],
    ],
    rebuttal:
      "Banks never block an account within hours over a phone call, and KYC is never completed by paying or sharing a PIN. This is the KYC-update scam.",
    stat: NATIONAL_STAT,
    source: NATIONAL_SOURCE,
  },
  {
    scam: "fake_customer_care",
    label: "Fake customer-care number scam",
    keywords: [
      [/\b(customer care|helpline|support number|toll ?free|customer service)\b/i, 4],
      [/\b(google|searched|search|found the number|online)\b/i, 3],
      [/\b(refund|failed|stuck|pending|not received|transaction failed)\b/i, 2],
      [/\b(anydesk|teamviewer|screen ?share|remote|install)\b/i, 3],
      [/\b(phonepe|gpay|google pay|paytm|amazon|flipkart|swiggy|zomato|irctc)\b/i, 1],
    ],
    rebuttal:
      "A helpline found through search results is not a helpline; scammers buy the top spots. Real support never asks you to install screen-sharing apps or pay to receive a refund. This is the fake customer-care scam.",
    stat: NATIONAL_STAT,
    source: NATIONAL_SOURCE,
  },
  {
    scam: "courier_parcel",
    label: "Courier / parcel-held scam",
    keywords: [
      [/\b(courier|parcel|package|shipment|bluedart|fedex|dhl|dtdc|customs)\b/i, 4],
      [/\b(drugs|illegal|narcotics|seized|held|contraband|passport)\b/i, 3],
      [/\b(penalty|fine|release|clearance|fee)\b/i, 2],
      [/\b(mumbai|delhi|chennai|bangalore|bengaluru) (customs|airport)\b/i, 2],
    ],
    rebuttal:
      "Customs and courier companies do not phone you about drugs in a parcel and they never take penalties by UPI. This is the courier-parcel scam, usually the first act of a digital arrest.",
    stat: NATIONAL_STAT,
    source: NATIONAL_SOURCE,
  },
  {
    scam: "electricity_disconnection",
    label: "Electricity disconnection scam",
    keywords: [
      [/\b(electricity|power|current|eb|tneb|bescom|msedcl|bill)\b/i, 4],
      [/\b(disconnect|disconnected|cut|cut off|tonight|today)\b/i, 3],
      [/\b(pending|unpaid|overdue|previous month)\b/i, 2],
      [/\b(lineman|officer|department)\b/i, 1],
    ],
    rebuttal:
      "Electricity boards send printed notices and never disconnect at night over a phone call, and they never collect through a personal UPI ID. This is the electricity-disconnection scam.",
    stat: NATIONAL_STAT,
    source: NATIONAL_SOURCE,
  },
  {
    scam: "lottery_prize",
    label: "Lottery / prize / KBC scam",
    keywords: [
      [/\b(lottery|prize|won|winner|lucky draw|kbc|jackpot|reward)\b/i, 4],
      [/\b(processing|tax|gst|registration|release) (fee|charge|amount)\b/i, 3],
      [/\b(lakh|crore|car|gift)\b/i, 1],
    ],
    rebuttal: "No genuine prize ever requires you to pay first. Any fee to release a prize is the scam itself.",
    stat: NATIONAL_STAT,
    source: NATIONAL_SOURCE,
  },
  {
    scam: "loan_app",
    label: "Predatory loan-app harassment",
    keywords: [
      [/\b(loan|emi|instant loan|app loan|lending app)\b/i, 4],
      [/\b(harass|threaten|threat|morph|photos|contacts|shame|defame)\b/i, 3],
      [/\b(interest|processing fee|repay|repayment|overdue)\b/i, 2],
      [/\b(student|college|hostel)\b/i, 1],
    ],
    rebuttal:
      "A lender that threatens you, contacts your family or demands extra fees is not an RBI-regulated lender. Do not pay; report the app. This is loan-app harassment.",
    stat: NATIONAL_STAT,
    source: NATIONAL_SOURCE,
  },
  {
    scam: "job_task",
    label: "Task / part-time job scam",
    keywords: [
      [/\b(task|tasks|part[- ]?time|work from home|like videos|rating|review|telegram)\b/i, 4],
      [/\b(deposit|invest|unlock|withdraw|commission|earn)\b/i, 3],
    ],
    rebuttal: "Real jobs pay you; they never ask you to deposit money to unlock your own earnings. This is the task-job scam.",
    stat: NATIONAL_STAT,
    source: NATIONAL_SOURCE,
  },
  {
    scam: "investment_trading",
    label: "Investment / trading scam",
    keywords: [
      [/\b(invest|investment|trading|stocks?|shares?|crypto|bitcoin|forex|ipo|returns?|profit)\b/i, 4],
      [/\b(guaranteed|double|daily|tips|group|whatsapp group|telegram)\b/i, 2],
      [/\b(withdraw|withdrawal|tax|unlock)\b/i, 2],
    ],
    rebuttal: "Guaranteed or daily returns do not exist, and a platform that asks for a fee to withdraw your own profit is the scam itself.",
    stat: NATIONAL_STAT,
    source: NATIONAL_SOURCE,
  },
  {
    scam: "family_emergency",
    label: "Family emergency / relative-in-trouble scam",
    keywords: [
      [/\b(son|daughter|grandson|granddaughter|nephew|niece|relative|friend)\b/i, 3],
      [/\b(accident|hospital|arrested|police station|emergency|urgent|stuck|abroad)\b/i, 3],
      [/\b(bail|treatment|surgery|fees)\b/i, 2],
    ],
    rebuttal: "Call the family member directly on their own number before sending anything. A real emergency survives a two-minute phone call; a scam does not.",
    stat: NATIONAL_STAT,
    source: NATIONAL_SOURCE,
  },
  {
    scam: "refund_scam",
    label: "Refund / collect-request scam",
    keywords: [
      [/\b(refund|cashback|reversal|excess|wrongly|by mistake|sent by mistake)\b/i, 4],
      [/\b(collect request|request money|approve|enter pin|pin to receive)\b/i, 4],
    ],
    rebuttal: "You never enter a PIN to receive money. A 'refund' that needs your PIN is a payment out of your account.",
    stat: NATIONAL_STAT,
    source: NATIONAL_SOURCE,
  },
];

const UNKNOWN: Classification = {
  scam: "unknown",
  label: "Unrecognised story, strong pressure signs",
  confidence: 0,
  rebuttal:
    "We could not match this to a known scam, but the signs of pressure are strong. Nobody genuine needs money from you in the next ten minutes. Please wait for Priya.",
  stat: NATIONAL_STAT,
  source: NATIONAL_SOURCE,
  markers: [],
};

export const SCAM_LABELS: Record<string, string> = Object.fromEntries(DEFS.map((d) => [d.scam, d.label]));

/** Deterministic; identical result offline. */
export function classifyNarrative(text: string): Classification {
  const t = (text || "").trim();
  if (!t) return UNKNOWN;
  const scored = DEFS.map((d) => {
    let s = 0;
    for (const [re, w] of d.keywords) if (re.test(t)) s += w;
    return { d, s };
  }).sort((a, b) => b.s - a.s);
  const top = scored[0];
  const second = scored[1]?.s ?? 0;
  const markers: MarkerKind[] = kindsPresent(detectMarkers(t));
  if (top.s === 0) return { ...UNKNOWN, markers };
  const confidence = Math.min(0.99, Math.round((top.s / (top.s + second + 2)) * 100) / 100);
  return {
    scam: top.d.scam,
    label: top.d.label,
    confidence,
    rebuttal: top.d.rebuttal,
    stat: top.d.stat,
    source: top.d.source,
    markers,
  };
}
