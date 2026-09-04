/**
 * Unit tests for the Agent engine — pure function tests.
 * Run: node src/lib/engine.test.js
 */
import { buildSteps, decideStatus, validatePayment, getTaskInfo, findTaskByQuery } from "./engine.js";

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.error(`  ❌ ${name}`);
    failed++;
  }
}

console.log("\n🧪 Agent Engine Tests\n");

// ─── Test: decideStatus ──────────────────────────────────────
console.log("decideStatus():");
assert(decideStatus(1240, 2000) === "paid", "₹1,240 ≤ ₹2,000 → paid");
assert(decideStatus(4600, 2000) === "awaiting_approval", "₹4,600 > ₹2,000 → awaiting_approval");
assert(decideStatus(2000, 2000) === "paid", "₹2,000 = ₹2,000 → paid (equal is within limit)");
assert(decideStatus(8500, 2000, true) === "declined", "Predatory loan app is immediately declined");

// ─── Test: validatePayment ───────────────────────────────────
console.log("\nvalidatePayment():");
assert(validatePayment(1240, 2000).allowed === true, "Within limit → allowed");
assert(validatePayment(4600, 2000).allowed === false, "Over limit, no guardian → blocked");
assert(validatePayment(4600, 2000, true).allowed === true, "Over limit, guardian approved → allowed");
assert(validatePayment(2000, 2000).allowed === true, "Equal to limit → allowed");
assert(validatePayment(2001, 2000).allowed === false, "₹1 over limit → blocked");
assert(validatePayment(8500, 10000, true, true).allowed === false, "Predatory loan blocked even with high limit");

// ─── Test: buildSteps ────────────────────────────────────────
console.log("\nbuildSteps():");
const stepsA = buildSteps("train_madurai", 2000);
assert(stepsA.length === 5, "Run A: 5 steps (search, verify, fill, price, pay)");
assert(stepsA[stepsA.length - 1].statusAfter === "paid", "Run A: last step → paid");

const stepsB = buildSteps("train_delhi", 2000);
assert(stepsB.length === 5, "Run B: 5 steps (search, verify, fill, price, request approval)");
assert(stepsB[stepsB.length - 1].statusAfter === "awaiting_approval", "Run B: last step → awaiting_approval");

// ─── Test: PRD A7 Shopping Purchase ──────────────────────────
console.log("\nPRD A7 Shopping Category:");
const stepsShop = buildSteps("shopping_bp", 2000);
assert(stepsShop.some((s) => s.text.includes("1mg.com")), "Shopping checks official 1mg.com");
assert(stepsShop[stepsShop.length - 1].statusAfter === "paid", "Shopping ₹1,850 ≤ ₹2,000 pays automatically");

// ─── Test: PRD A8 Customer Care Shield ───────────────────────
console.log("\nPRD A8 Customer Care Shield:");
const stepsSupport = buildSteps("support_sbi", 2000);
assert(stepsSupport.some((s) => s.text.includes("1800-11-2211")), "Returns verified toll-free SBI number");
assert(stepsSupport.some((s) => s.text.includes("Blocked 3 sponsored SEO search ad")), "Blocks search engine ad look-alikes");

// ─── Test: PRD A9 Loan App Checkpoint ────────────────────────
console.log("\nPRD A9 Loan-App Checkpoint:");
const stepsLoan = buildSteps("loan_app_stop", 2000);
assert(stepsLoan.some((s) => s.text.includes("CRITICAL ALERT")), "Detects unregistered predatory lender");
assert(stepsLoan[stepsLoan.length - 1].statusAfter === "declined", "Loan app transfer permanently blocked");

// ─── Test: Query Parser ──────────────────────────────────────
console.log("\nQuery Parser (findTaskByQuery):");
assert(findTaskByQuery("madurai") === "train_madurai", "Finds Madurai train from text");
assert(findTaskByQuery("delhi 2ac") === "train_delhi", "Finds Delhi 2AC train from text");
assert(findTaskByQuery("buy bp monitor") === "shopping_bp", "Finds Omron BP monitor from text");
assert(findTaskByQuery("sbi customer care") === "support_sbi", "Finds SBI helpline from text");
assert(findTaskByQuery("pay instant loan") === "loan_app_stop", "Finds loan app stop from text");

// ─── Test: getTaskInfo ───────────────────────────────────────
console.log("\ngetTaskInfo():");
const madurai = getTaskInfo("train_madurai");
assert(madurai !== null, "train_madurai exists");
assert(madurai.price === 1240, "Madurai price is ₹1,240");
assert(madurai.officialSite === "irctc.co.in", "Official site is irctc.co.in");

const delhi = getTaskInfo("train_delhi");
assert(delhi !== null, "train_delhi exists");
assert(delhi.price === 4600, "Delhi price is ₹4,600");

assert(getTaskInfo("nonexistent") === null, "Nonexistent task returns null");

// ─── Summary ─────────────────────────────────────────────────
console.log(`\n${"═".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(40)}\n`);

process.exit(failed > 0 ? 1 : 0);
