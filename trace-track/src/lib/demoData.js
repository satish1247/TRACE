/**
 * Simulated account data for the demo.
 * Each account has a VPA, name, balance, and kind.
 */

export const VICTIM = {
  uid: 'victim-001',
  name: 'Priya Sharma',
  vpa: 'priya@upi',
  balance: 75000,
};

export const SCAMMER = {
  uid: 'scammer-001',
  name: 'Unknown Caller',
  vpa: 'fraud.agent@upi',
  balance: 0,
};

// 10 mule accounts that scammer splits money to
export const MULES = [
  { uid: 'mule-01', name: 'Ravi Kumar', vpa: 'ravi.k01@upi', balance: 12000, kind: 'mule' },
  { uid: 'mule-02', name: 'Sunil Yadav', vpa: 'sunil.y02@upi', balance: 8500, kind: 'mule' },
  { uid: 'mule-03', name: 'Deepak Jha', vpa: 'deepak.j03@upi', balance: 15000, kind: 'mule' },
  { uid: 'mule-04', name: 'Amit Verma', vpa: 'amit.v04@upi', balance: 6200, kind: 'mule' },
  { uid: 'mule-05', name: 'Rajesh Gupta', vpa: 'rajesh.g05@upi', balance: 9800, kind: 'mule' },
  { uid: 'mule-06', name: 'Vikram Singh', vpa: 'vikram.s06@upi', balance: 11000, kind: 'mule' },
  { uid: 'mule-07', name: 'Manoj Patel', vpa: 'manoj.p07@upi', balance: 7300, kind: 'mule' },
  { uid: 'mule-08', name: 'Karan Mehta', vpa: 'karan.m08@upi', balance: 14200, kind: 'mule' },
  { uid: 'mule-09', name: 'Nitin Das', vpa: 'nitin.d09@upi', balance: 5400, kind: 'mule' },
  { uid: 'mule-10', name: 'Sanjay Mishra', vpa: 'sanjay.m10@upi', balance: 10100, kind: 'mule' },
];

// Second-layer splits: 3 of the mules split further
// Mule 1 → 2 accounts (one is an innocent tea stall)
export const LAYER3 = [
  // From Mule 1
  { uid: 'l3-01', name: 'Chai Corner (Ramesh)', vpa: 'ramesh.chai@upi', balance: 200000, kind: 'merchant', fromMuleIndex: 0, amount: 20 },
  { uid: 'l3-02', name: 'Cash ATM W/d', vpa: 'cashout.atm1@upi', balance: 0, kind: 'cashout', fromMuleIndex: 0, amount: 1980 },
  // From Mule 3
  { uid: 'l3-03', name: 'Kirana Store (Anil)', vpa: 'anil.kirana@upi', balance: 150000, kind: 'merchant', fromMuleIndex: 2, amount: 50 },
  { uid: 'l3-04', name: 'Cash ATM W/d 2', vpa: 'cashout.atm2@upi', balance: 0, kind: 'cashout', fromMuleIndex: 2, amount: 2950 },
  // From Mule 6
  { uid: 'l3-05', name: 'Vegetable Vendor (Lakshmi)', vpa: 'lakshmi.veg@upi', balance: 85000, kind: 'merchant', fromMuleIndex: 5, amount: 30 },
  { uid: 'l3-06', name: 'Mobile Recharge', vpa: 'recharge.shop@upi', balance: 45000, kind: 'individual', fromMuleIndex: 5, amount: 1970 },
];

// Fourth layer: from the tea stall's customer
export const LAYER4 = [
  { uid: 'l4-01', name: 'Tea Customer (Arjun)', vpa: 'arjun.tea@upi', balance: 8600, kind: 'individual', fromL3Index: 0, amount: 10 },
];

// Default split amounts for scammer screen (total = 50000)
export const DEFAULT_SPLITS = [5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000];
