/**
 * Agent State Machine — pure functions, unit-testable.
 *
 * State transitions:
 *   idle → searching → filling → priced
 *     ├─ price ≤ limit → paid
 *     ├─ price > limit → awaiting_approval → paid | declined
 *     ├─ isLoanApp → blocked (harassment protection)
 *     └─ isSupportInfo → verified_info
 */

/** Scripted task catalogue — SIMULATED, never hits a real site */
const CATALOGUE = {
  // ── Train Bookings (PRD Runs A & B) ──
  train_madurai: {
    category: "train",
    name: "Train: Chennai → Madurai (Sleeper)",
    request: "Book the Madurai train on the 12th",
    officialSite: "irctc.co.in",
    officialName: "IRCTC Official Portal (Govt of India)",
    fakeSitesIgnored: [
      { domain: "irctc-booking.com", threat: "SEO Search Ad Phishing" },
      { domain: "irctc-trains.in", threat: "Credential Harvesting" },
      { domain: "irctchelp.co", threat: "Payment Gateway Hijack" },
    ],
    item: "Chennai → Madurai, Sleeper, Sep 12",
    price: 1240,
    merchant: "Indian Railways (IRCTC)",
    reference: "PNR-4829104812",
  },
  train_delhi: {
    category: "train",
    name: "Train: Chennai → Delhi (2AC)",
    request: "Book the Delhi train, 2AC",
    officialSite: "irctc.co.in",
    officialName: "IRCTC Official Portal (Govt of India)",
    fakeSitesIgnored: [
      { domain: "irctc-booking.com", threat: "SEO Search Ad Phishing" },
      { domain: "irctc-trains.in", threat: "Credential Harvesting" },
      { domain: "irctchelp.co", threat: "Payment Gateway Hijack" },
    ],
    item: "Chennai → Delhi, 2AC, Sep 12",
    price: 4600,
    merchant: "Indian Railways (IRCTC)",
    reference: "PNR-9182374650",
  },

  // ── Healthcare & Shopping Purchase (PRD A7) ──
  shopping_bp: {
    category: "shopping",
    name: "Shopping: Omron BP Monitor",
    request: "Buy Omron Blood Pressure Monitor on Tata 1mg",
    officialSite: "1mg.com",
    officialName: "Tata 1mg Verified Healthcare Store",
    fakeSitesIgnored: [
      { domain: "tata1mg-offers.top", threat: "Fake Medical Discount Scam" },
      { domain: "cheap-bp-monitor.org", threat: "Counterfeit Health Device" },
      { domain: "1mg-healthsupport.net", threat: "Unauthorized Merchant Clone" },
    ],
    item: "Omron HEM-7120 Digital Blood Pressure Monitor",
    price: 1850,
    merchant: "Tata 1mg Healthcare",
    reference: "ORD-1MG-847291",
  },
  shopping_watch: {
    category: "shopping",
    name: "Shopping: Titan Smartwatch (Exceeds Limit)",
    request: "Buy Titan Smartwatch for grandson",
    officialSite: "titan.co.in",
    officialName: "Titan Official Brand Store",
    fakeSitesIgnored: [
      { domain: "titan-sale-discount.in", threat: "Cloned Brand Storefront" },
      { domain: "titanwatches-mall.xyz", threat: "Credit Card Skimmer" },
    ],
    item: "Titan Talk Smartwatch with Heart Rate & GPS",
    price: 5490,
    merchant: "Titan Company Ltd",
    reference: "ORD-TTN-391820",
  },

  // ── Verified Helpline Shield (PRD A8) ──
  support_sbi: {
    category: "support",
    name: "Verified Helpline: SBI Customer Care",
    request: "Find SBI customer care number",
    officialSite: "sbi.co.in",
    officialName: "State Bank of India Official Portal",
    fakeSitesIgnored: [
      { domain: "sbi-quickcare-helpline.org", threat: "SEO Poisoned Fake Ad (AnyDesk Scam)" },
      { domain: "sbi-support-tollfree.net", threat: "Bogus Customer Care Trap" },
      { domain: "sbi-kyc-service.in", threat: "Fake APK Download Phishing" },
    ],
    item: "SBI 24/7 Verified Toll-Free Helpline: 1800-11-2211 / 1800-425-3800",
    price: 0,
    verifiedPhone: "1800-11-2211",
    merchant: "State Bank of India (RBI Regulated)",
    isHelpline: true,
  },
  support_irctc: {
    category: "support",
    name: "Verified Helpline: IRCTC Railway Helpline",
    request: "IRCTC customer support number",
    officialSite: "irctc.co.in",
    officialName: "IRCTC Official Customer Care",
    fakeSitesIgnored: [
      { domain: "irctc-refund-tollfree.com", threat: "Google Search Ad Impersonation" },
      { domain: "railway-ticket-support.co", threat: "Refund Scam & OTP Stealer" },
    ],
    item: "IRCTC Railway All-India Helpline: 139 (24x7 Rail Madad)",
    price: 0,
    verifiedPhone: "139",
    merchant: "Ministry of Railways, India",
    isHelpline: true,
  },

  // ── Predatory Loan-App Checkpoint (PRD A9) ──
  loan_app_stop: {
    category: "loan_check",
    name: "Safety Shield: Instant Loan App Checkpoint",
    request: "Pay ₹8,500 to QuickRupee Instant Cash app",
    officialSite: "rbi.org.in (Whitelist Check)",
    officialName: "RBI NBFC Registry Verification",
    fakeSitesIgnored: [
      { domain: "quickrupee-cash.apk", threat: "Blacklisted Chinese Sideload APK" },
      { domain: "instant-money-loan.club", threat: "Contact Harvesting & Extortion" },
    ],
    item: "Repayment to QuickRupee / FastCredit App",
    price: 8500,
    merchant: "UNREGISTERED LENDER (RBI Blacklist #9421)",
    isPredatoryLoan: true,
  },
};

/**
 * Build the step sequence for a given task key.
 * Returns an array of { text, delayMs, statusAfter, metadata } objects.
 */
export function buildSteps(taskKey, limit) {
  const task = CATALOGUE[taskKey];
  if (!task) throw new Error(`Unknown task: ${taskKey}`);

  const fakeCount = task.fakeSitesIgnored ? task.fakeSitesIgnored.length : 0;
  const fakeDomains = task.fakeSitesIgnored
    ? task.fakeSitesIgnored.map((f) => (typeof f === "string" ? f : f.domain))
    : [];

  // Special branch: Predatory Loan-App Checkpoint (PRD A9)
  if (task.isPredatoryLoan) {
    return [
      {
        text: `Analyzing payment recipient for "${task.item}"…`,
        statusAfter: "searching",
        delayMs: 900,
      },
      {
        text: `Running RBI Digital Lending Whitelist Registry check…`,
        statusAfter: "searching",
        delayMs: 900,
      },
      {
        text: `CRITICAL ALERT: Recipient is an UNREGISTERED, predatory loan app (Blacklist #9421). Found malware indicators on ${fakeDomains.join(", ")}.`,
        statusAfter: "declined",
        delayMs: 1000,
        threatLevel: "CRITICAL",
      },
      {
        text: `PAYMENT PERMANENTLY BLOCKED: Identified as coercive loan-app harassment. No funds will be transferred. Guardian & Cyber Cell notified.`,
        statusAfter: "declined",
        delayMs: 900,
        isBlockedLoan: true,
      },
    ];
  }

  // Special branch: Verified Helpline Shield (PRD A8)
  if (task.isHelpline) {
    return [
      {
        text: `Intercepting customer support search for "${task.request}"…`,
        statusAfter: "searching",
        delayMs: 900,
      },
      {
        text: `SHIELD ACTIVE: Blocked ${fakeCount} sponsored SEO search ad look-alikes (${fakeDomains.join(", ")})`,
        statusAfter: "searching",
        delayMs: 900,
      },
      {
        text: `Verified directly from official government registry: ${task.officialSite} (${task.officialName})`,
        statusAfter: "filling",
        delayMs: 900,
      },
      {
        text: `Verified Official Helpline: ${task.verifiedPhone} (Never dial numbers from search engine ads).`,
        statusAfter: "paid",
        delayMs: 900,
        helplineNumber: task.verifiedPhone,
      },
    ];
  }

  // Standard booking & shopping sequence (PRD A2, A3, A4, A5)
  const steps = [
    {
      text: `Searching for "${task.item}"…`,
      statusAfter: "searching",
      delayMs: 900,
    },
    {
      text: `Found official site: ${task.officialSite} — ignored ${fakeCount} look-alikes (${fakeDomains.join(", ")})`,
      statusAfter: "searching",
      delayMs: 900,
    },
    {
      text: `Filling details securely on official portal: ${task.officialSite}…`,
      statusAfter: "filling",
      delayMs: 900,
    },
    {
      text: `Price verified: ₹${task.price.toLocaleString("en-IN")} — your spending limit is ₹${limit.toLocaleString("en-IN")}`,
      statusAfter: "filling",
      delayMs: 900,
    },
  ];

  if (task.price <= limit) {
    steps.push({
      text: `Price ₹${task.price.toLocaleString("en-IN")} is within your limit. Paying now…`,
      statusAfter: "paid",
      delayMs: 900,
    });
  } else {
    steps.push({
      text: `Price ₹${task.price.toLocaleString("en-IN")} exceeds your limit of ₹${limit.toLocaleString("en-IN")}. Requesting guardian approval…`,
      statusAfter: "awaiting_approval",
      delayMs: 900,
    });
  }

  return steps;
}

/**
 * Decide the final status after pricing.
 */
export function decideStatus(price, limit, isPredatoryLoan = false) {
  if (isPredatoryLoan) return "declined";
  return price <= limit ? "paid" : "awaiting_approval";
}

/**
 * Get task info from the catalogue.
 */
export function getTaskInfo(taskKey) {
  return CATALOGUE[taskKey] ?? null;
}

/**
 * Validate that a payment should proceed — enforce at the write, not in the UI.
 * Returns { allowed: boolean, reason: string }
 */
export function validatePayment(price, limit, guardianApproved = false, isPredatoryLoan = false) {
  if (isPredatoryLoan) {
    return { allowed: false, reason: "Blocked: Predatory loan harassment check failed" };
  }
  if (price <= limit) {
    return { allowed: true, reason: "Within spending limit" };
  }
  if (guardianApproved) {
    return { allowed: true, reason: "Guardian approved" };
  }
  return { allowed: false, reason: `Price ₹${price} exceeds limit ₹${limit} — guardian approval required` };
}

/**
 * Natural language query parser:
 * Matches user's plain English voice or typed query to catalogue tasks or constructs a safe task.
 */
export function findTaskByQuery(query) {
  if (!query || typeof query !== "string") return "train_madurai";
  const q = query.toLowerCase().trim();

  if (q.includes("loan") || q.includes("quickrupee") || q.includes("fastcash") || q.includes("emi") || q.includes("harass")) {
    return "loan_app_stop";
  }
  if (q.includes("sbi") || q.includes("bank care") || q.includes("bank helpline")) {
    return "support_sbi";
  }
  if (q.includes("irctc care") || q.includes("railway helpline") || q.includes("139") || q.includes("support")) {
    return "support_irctc";
  }
  if (q.includes("delhi") || q.includes("2ac") || q.includes("4600")) {
    return "train_delhi";
  }
  if (q.includes("bp") || q.includes("monitor") || q.includes("blood pressure") || q.includes("1mg") || q.includes("medicine")) {
    return "shopping_bp";
  }
  if (q.includes("watch") || q.includes("titan") || q.includes("smartwatch") || q.includes("gift")) {
    return "shopping_watch";
  }
  if (q.includes("madurai") || q.includes("sleeper") || q.includes("chennai") || q.includes("train")) {
    return "train_madurai";
  }

  // Default fallback to Run A
  return "train_madurai";
}

export { CATALOGUE };
