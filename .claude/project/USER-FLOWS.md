# User flows

Every flow lists its failure paths. Screens: `/phone` (Lakshmi), `/guardian` (Priya), `/stage` (projector), `/presenter` (control).

## Flow 1 - ordinary payment (Beat 1)

1. Presenter: Reset, then Beat 1. Phone shows home with balance and payees.
2. Lakshmi taps "Kumar Stores" (known payee), types 340, taps Pay.
3. Client computes signals: no call, no remote app, known payee, typed VPA, 0 app switches, hesitation low. Score < soft threshold.
4. PIN screen. Enters 4471. Success screen with reference. Stage shows Coercion panel at a low score.

Failure paths: wrong PIN -> "PIN did not match, try again" (no lockout in demo); empty amount -> Pay disabled; server unreachable -> phone shows "Reconnecting" banner and retries every 400 ms.

## Flow 2 - the scam call (Beat 2)

1. Presenter: Beat 2 (or Start Call). Phone shows incoming call from "+91 11 2xxx (Delhi Police?)". Stage switches to Call tab.
2. Transcript plays one line every ~2.5 s. Each line is scored; markers light up in order: authority, threat, isolation, demand, blocking. Risk bar rises.
3. Attestation check runs on the first authority claim: no attested call from any police unit -> phone shows the red attestation line.
4. Phone shows the "Add Priya to this call" button once risk passes the conference threshold.

Failure paths: presenter stops call -> transcript halts, markers stay; mic input (optional) returns nothing -> nothing changes, no error shown; conference tapped -> scripted scammer line "[caller disconnected]" and guardian screen shows joined.

## Flow 3 - the coerced payment, interview and co-sign (Beat 3)

1. Presenter: Beat 3 (sets call active, remote app AnyDesk present, injects payee "verification-desk@fedbank" as pasted, app switches 3).
2. Lakshmi opens Pay, payee is pre-filled as new and pasted, types 50000 with hesitation (the client measures pauses, backspaces and inter-key variance from her actual typing).
3. Score crosses the hold threshold -> tier HOLD. Phone: calm screen "One minute. In your own words, who is this money for, and why?" with mic and type options.
4. Lakshmi (or a judge) answers. Classifier -> digital_arrest. Phone: named rebuttal with statistic. Stage: Coercion panel plus classification.
5. Guardian screen receives the request with everything. Priya taps Veto -> phone shows "Priya stopped this payment" and the money is untouched. (Approve path exists and would complete the payment.)
6. Alternative: Lakshmi enters the duress PIN 9999 instead of 4471 at the PIN step -> receipt "Under bank verification, ref TRC-xxxx, 30 min" is shown; funds held; guardian alerted; interview opens after the receipt.

Failure paths: empty interview answer -> "Say or type a few words"; unclassifiable answer -> tier stays HOLD, guardian still asked, rebuttal shows the generic "we could not match this to a known scam, but the signs of pressure are strong"; guardian offline -> phone keeps waiting with a visible "Waiting for Priya" state and a "Cancel payment" option; poll fails -> reconnecting banner.

## Flow 4 - the money already left (Beat 4)

1. Presenter: Beat 4 (counterfactual: Rs 50,000 debited at T0). Stage switches to Trace tab. Golden-hour clock starts.
2. The tree reveals one hop per presenter Advance (or every 3 s in auto): L1 scammer VPA, L2 ten mules, L3 mules and an innocent tea shop, L4 the shop's customer.
3. Proportional Freeze runs on each reveal. Ledger updates: held vs free per account. Tea shop: Rs 20 held, Rs 1,99,990 free. Customer: Rs 0 held.
4. Settlement points are marked; "Recovered" total updates. Evidence pack becomes available (Confirm incident requires a presenter click - the human in the loop).

Failure paths: Advance past the last hop does nothing; Confirm before any hold -> button disabled with reason.

## Flow 5 - immunity (Beat 5)

1. Presenter: Confirm incident. Mule VPA and script signature publish to the network registry. Stage: Network tab; campaign banner if the fingerprint count crosses the window threshold.
2. Presenter: Beat 5. Phone: new payment attempt to the mule VPA -> blocked before the PIN step: "This account was reported 12 minutes ago by another TRACE user. Payment not started."

Failure paths: payment to a clean VPA still works (shown if asked); reset clears the registry (it is a demo; say so).

## Flow 6 - rehearsal (after beats)

1. Presenter: Run drill. Phone: simulated call from "Courier - parcel held". Lakshmi picks a response: comply / hang up / ask Priya.
2. Comply -> lesson card and threshold shift -5 (earlier intervention next time). Hang up or ask -> praise and shift +2. Stage shows the shift.

Failure paths: drill while a real call is active -> refused with reason.
