/**
 * Proportional Freeze — the core taint math.
 *
 * taint(child) = child.amount × (taint(parent) / (parent.balanceBefore + parent.amount))
 * held         = taint >= FLOOR ? min(taint, currentBalance) : 0
 * FLOOR        = 15 (rupees)
 * currentBalance = balanceBefore + amount - forwarded
 */

export const FLOOR = 15; // rupees

export function calculateTaint(childAmount, parentTaint, parentBalanceBefore, parentAmount) {
  if (parentBalanceBefore + parentAmount === 0) return 0;
  return childAmount * (parentTaint / (parentBalanceBefore + parentAmount));
}

export function calculateHeld(taint, currentBalance) {
  if (taint < FLOOR) return 0;
  return Math.min(taint, currentBalance);
}

export function currentBalance(balanceBefore, amount, forwarded) {
  return balanceBefore + amount - forwarded;
}

/**
 * Full computation for a hop given its parent's context.
 * Returns { taint, held, free, currentBalance }
 */
export function computeHop({ amount, balanceBefore, forwarded, parentTaint, parentBalanceBefore, parentAmount }) {
  const taint = calculateTaint(amount, parentTaint, parentBalanceBefore, parentAmount);
  const cb = currentBalance(balanceBefore, amount, forwarded);
  const held = calculateHeld(taint, cb);
  const free = cb - held;
  return { taint: Math.round(taint * 100) / 100, held: Math.round(held * 100) / 100, free: Math.round(free * 100) / 100, currentBalance: cb };
}

/**
 * Unit test: ₹50,000 stolen, split to 10 mules (₹5,000 each).
 * Mule → tea stall with ₹2,00,000 balance, ₹20 payment.
 * Tea stall's customer gets ₹10.
 */
export function runUnitTest() {
  // L1: Scammer receives ₹50,000
  const l1 = computeHop({ amount: 50000, balanceBefore: 0, forwarded: 50000, parentTaint: 50000, parentBalanceBefore: 0, parentAmount: 50000 });
  console.assert(l1.taint === 50000, `L1 taint should be 50000, got ${l1.taint}`);

  // L2: Mule receives ₹5,000 from scammer
  const l2 = computeHop({ amount: 5000, balanceBefore: 0, forwarded: 20, parentTaint: 50000, parentBalanceBefore: 0, parentAmount: 50000 });
  console.assert(l2.taint === 5000, `L2 taint should be 5000, got ${l2.taint}`);
  console.assert(l2.held === 4980, `L2 held should be 4980, got ${l2.held}`);

  // L3: Tea stall (innocent merchant) receives ₹20, has ₹2,00,000 balance
  const l3 = computeHop({ amount: 20, balanceBefore: 200000, forwarded: 10, parentTaint: 5000, parentBalanceBefore: 0, parentAmount: 5000 });
  console.assert(l3.taint === 20, `L3 taint should be 20, got ${l3.taint}`);
  console.assert(l3.held === 20, `L3 held should be 20, got ${l3.held}`);
  // free = (200000 + 20 - 10) - 20 = 199990
  console.assert(l3.free === 199990, `L3 free should be 199990, got ${l3.free}`);

  // L4: Customer receives ₹10 from tea stall
  const l4 = computeHop({ amount: 10, balanceBefore: 8600, forwarded: 0, parentTaint: 20, parentBalanceBefore: 200000, parentAmount: 20 });
  // taint = 10 * (20 / 200020) ≈ 0.001 → below floor of 15
  console.assert(l4.held === 0, `L4 held should be 0, got ${l4.held}`);

  console.log('✅ All taint unit tests passed!');
  return true;
}
