# Data model (in-memory store)

There is no database process. `lib/store.ts` holds one `State` object; the reducer is the only writer; `version` increments on every change so clients can diff cheaply. Reset replaces the object with the scenario seed.

## Entities

| Entity | Fields | Notes |
|---|---|---|
| User | name, vpa, balance, pin, duressPin, thresholdShift, payees[] | pins are demo constants (4471 / 9999); thresholdShift is set by rehearsal |
| Payee | id, name, vpa, known (bool) | known drives the newPayee signal |
| Call | active, callerId, callerName, claimsAuthority, attested, attestationCode, transcript[], cursor, markers[], risk, ended, conferenced, fingerprint | transcript is the scripted scam; live lines are appended |
| MarkerHit | kind (authority/threat/isolation/demand/blocking), lineIndex, phrase | one per detection |
| Device | remoteAccessApp (string or null), appSwitches | set by presenter toggles |
| Payment | stage, payee, amount, signals, score, breakdown[], tier, reason, receiptRef, interview {question, answer, classification}, decision | stage is a finite set (see API.md) |
| CosignRequest | id, createdAt, amount, payee, score, markers[], answer, decision | shown on /guardian |
| TraceNode | id, hop, label, vpa, kind (scammer/mule/merchant/individual), balanceBefore, received, taint, held, free, settlement (bool), parentId | produced by lib/taint.ts |
| Hold | nodeId, amount, placedAt, simulated: true | sums to recovered |
| ImmuneEntry | vpa, reportedAt, incidentId, simulated: true | checked before any payment starts |
| ScriptSignature | fingerprint, scam, firstSeen, count | campaign detection reads count over a window |
| Campaign | fingerprint, scam, count, windowMinutes, region, thresholdBoost | at most one active in the demo |
| Reputation | number -> {reports, lastSeen, flagged} | caller reputation |
| Event | ts, type, summary | observability log, capped at 200 |
| Rehearsal | lastResult, lessons[] | |

## Invariants and where they are enforced

- `payment.stage` transitions follow the state machine in API.md; enforced in the reducer (illegal transition -> action rejected with reason, no state change).
- `held <= taint <= received` for every TraceNode; enforced in `propagateTaint` and asserted by tests.
- `held == 0` when `taint < floor`; enforced in `propagateTaint` (the de-minimis rule).
- `free == balanceBefore + received - held`; computed, never stored separately.
- A payment to a VPA in `network.immune` never reaches stage `pin`; enforced at `pay.review`.
- `version` strictly increases; enforced by the reducer wrapper.
- Only role `guardian` may decide a co-sign; only role `presenter` may set beats, toggles and confirm incidents; enforced in the action handler before the reducer.

## Migrations

None. The seed is code (`lib/scenario.ts`); changing it is a code change with tests.
