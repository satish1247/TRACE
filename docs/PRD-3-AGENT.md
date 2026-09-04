# PRD 3 — AGENT · Precaution

**Owner: Member 3** · Routes `/agent/*` · Writes `agentTasks`

Read `docs/SCHEMA.md` first. Never write to a collection you do not own.

## What you are building

A senior says what she wants in plain words. The agent finds the **official** site, fills the
details, and pays **only up to the limit she set**. Above that limit it stops and asks her
daughter. It can never spend more than she allowed.

This closes the loop the other two open: SHIELD stops the scam call, TRACK chases the money, AGENT
removes the reason she was on a dodgy website in the first place.

> The problem it solves: every AI agent today breaks at the payment step and hands control back to
> the user. That hand-back is exactly where a confused senior gets exploited.

## Why this is fraud prevention, not shopping

Two of the biggest doorways into fraud in India are searching for a **customer-care number** and
searching for a **booking site**. Both return SEO-poisoned fakes. An agent that only ever visits
verified official destinations closes both doors.

## Requirements

| ID | Requirement | Acceptance test | Pri |
|---|---|---|---|
| A1 | Plain-language request | "Book the Madurai train on the 12th", or a shopping item | P0 |
| A2 | Verified destination only | Shows the official site chosen and how many look-alikes it ignored | P0 |
| A3 | Visible step log | find → fill → price → decide, one line at a time | P0 |
| A4 | Spending limit enforced | ≤ limit pays automatically; > limit **cannot** pay | P0 |
| A5 | Guardian approval path | Writes `status: 'awaiting_approval'`; guardian approves or declines | P0 |
| A6 | Balance actually changes | On payment the `users` balance decreases; receipt shown | P0 |
| A7 | Two categories | Train ticket and one shopping purchase, both end to end | P0 |
| A8 | Verified-link shield | "customer care number" returns the verified number, never search results | P1 |
| A9 | Loan-app checkpoint | Paying an unregistered lender is stopped and named as loan-app harassment | P1 |
| A10 | Realtime | Guardian's decision reflects on the agent screen via onSnapshot | P0 |

## The two scripted runs, both must work

| Run | Item | Price | Limit | Expected |
|---|---|---|---|---|
| A | Chennai → Madurai, sleeper | ₹1,240 | ₹2,000 | Pays. Receipt. Balance drops. |
| B | Chennai → Delhi, 2AC | ₹4,600 | ₹2,000 | Stops. Guardian asked. Nothing paid until approved. |

Run B is the important one. **Demonstrate the refusal, not just the success.** A judge trusts an
agent that visibly refuses far more than one that always succeeds.

## Screens

- `/agent` — request box, limit control, animated step log, receipt or approval-pending card
- `/agent/guardian` — the daughter's approve or decline screen, showing what the agent wants to buy

## State machine

```
idle → find_official → fill → price
                                ├─ price ≤ limit → paid
                                └─ price > limit → awaiting_approval → paid | declined
```

Keep it a pure function you can unit-test, like the other modules' engines. Both branches get a test.

## Traps

1. **Never visit a real site or move real money.** Everything is scripted and labelled SIMULATED on
   screen. Say so before a judge asks.
2. Enforce the limit at the write, not in the button, so a UI bug cannot overspend.
3. Do not write to `incidents` or `calls`.
4. Keep the step delay around 900 ms. Faster looks fake; slower loses the room.

## Done when

Run A pays and the balance drops. Run B stops, the guardian screen lights up on another device,
approving completes the payment, declining leaves the money untouched. Both without a refresh.
