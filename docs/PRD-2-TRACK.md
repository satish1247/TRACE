# PRD 2 — TRACK · Protection

**Owner: Member 2** · Routes `/pay/*`, `/dashboard` · Writes `incidents`, `incidents/*/hops`, `accounts`

Read `docs/SCHEMA.md` first. Never write to a collection you do not own.

This is the module judges will remember. Build it well.

## What you are building

Two phone screens that look like a real UPI app, and one dashboard that watches the money.

1. The victim pays the scammer from a UPI-style screen.
2. The scammer's screen splits it to ten accounts; some of those split again.
3. The victim taps **Report fraud**.
4. The dashboard traces the tree hop by hop against a golden-hour clock, freezes **only the stolen
   rupees**, and animates the recovery back to the victim.

## The idea that wins the room

India's enforcement uses **full taint**: touch tainted money and your whole account dies. One
Faridabad case froze 36,000+ accounts. A nursery owner accepted **₹150** and had **₹1 lakh+** frozen
for months. The Supreme Court has directed RBI to write an SOP for exactly this.

**Proportional Freeze holds the amount, not the person.**

```
taint(child) = child.amount × (taint(parent) / (parent.balanceBefore + parent.amount))
held         = taint >= 15 ? min(taint, currentBalance) : 0
```

| Hop | Account | Received | Held | Free |
|---|---|---|---|---|
| L1 | Scammer | ₹50,000 | ₹50,000 | ₹0 |
| L2 | Mule ×10 | ₹5,000 | ₹5,000 | ₹0 |
| L3 | Tea stall, innocent | ₹20 | ₹20 | **₹1,99,990** |
| L4 | His customer, innocent | ₹10 | **₹0, below floor** | ₹8,610 |

**This table is your unit test.** If it passes, the feature is real.

> Say on stage: *"We catch the scammer without punishing the man who sold him a cup of tea."*

## Requirements

| ID | Requirement | Acceptance test | Pri |
|---|---|---|---|
| T1 | Victim UPI panel | Balance, payees, amount, PIN pad; looks like a real UPI app | P0 |
| T2 | Scammer UPI panel | Receives, splits to 10 accounts with editable amounts | P0 |
| T3 | Second-layer split | ≥3 of the 10 split again; one receiver is an innocent shop with a large balance | P0 |
| T4 | Report fraud | Writes an `incidents` document; dashboard reacts within a second | P0 |
| T5 | Golden-hour clock | 60-minute countdown from the report, visible and running | P0 |
| T6 | Animated hop-by-hop map | Nodes appear layer by layer, money flowing along the edges | P0 |
| T7 | Proportional Freeze | The table above passes exactly; holds animate as red locks | P0 |
| T8 | Recovery animation | Held amounts travel back; victim balance visibly increases | P0 |
| T9 | Network immunity | Paying a flagged VPA is blocked before it starts, with the reason | P1 |
| T10 | Evidence pack | NCRP / CFCFRMS / STR draft, labelled SIMULATED, human-confirm required | P1 |
| T11 | Everything realtime | Two windows stay in step via onSnapshot, never polling | P0 |

## Screens

- `/pay/victim` — phone-width UPI app, PIN pad, Report fraud
- `/pay/scammer` — phone-width, incoming money and the ten splits
- `/dashboard` — projector: clock, animated tree, ledger (received / taint / held / free), recovered total

## Make the map good

This is your showpiece. Use inline **SVG**, not a chart library.

- Nodes are circles sized by amount; edges are paths with a flowing dash animation
- Colour by kind: scammer red, mule amber, innocent merchant teal, cash-out grey
- When a hold lands, pulse the node red and print the held rupees on it
- Recovery: animate a dot travelling the edges back to the victim
- Respect `prefers-reduced-motion`
- Keep the clock and recovered total readable from the back of a room

## Traps

1. **Never write to `calls` or `detections`** — those are Member 1's.
2. Use `vpaKey()` from `src/lib/firebase.ts` for ids; `.` and `@` break paths.
3. Copy `src/lib/taint.ts`; do not fork the maths.
4. A hold can never exceed current balance. Assert it.
5. Cash-outs are tainted but cannot be held. Show them as money that escaped.

## Done when

Pay on the victim panel, split, tap Report fraud, and the dashboard traces four layers under a
running clock, freezes ₹20 in the tea stall while leaving ₹1,99,990 alone, and animates recovery
back. Two windows, no refresh.
