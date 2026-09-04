# Architecture

One Next.js process. Four browser screens share one in-memory state on the server and poll it. Pure, tested libraries do the thinking; screens only render state and send actions.

```
browser /phone      browser /guardian     browser /stage      browser /presenter
    |  SSE: GET /api/stream, server pushes on every change (all four) |
    |  POST /api/action {type, payload}  (role header)               |
    v                                                                 v
+---------------------------- Next.js route handlers ---------------------------+
|  app/api/stream     -> Server-Sent Events; pushes state the instant it changes
|  app/api/state      -> snapshot + version (fallback and health check)                                  |
|  app/api/action     -> validates, checks role, runs reducer, appends event     |
|  app/api/classify   -> pure classifier (also used by reducer)                  |
|  app/api/screen     -> pure marker detector for live mic lines                 |
|  app/api/evidence   -> renders the evidence pack from state                    |
+-------------------------------------------------------------------------------+
|  lib/store.ts     in-memory state + reducer (single writer, version counter)   |
|  lib/scenario.ts  seeds: Lakshmi, payees, scripted call, tree seed             |
|  lib/screening.ts five-marker detector, risk accumulator, fingerprint          |
|  lib/taxonomy.ts  scam taxonomy + classifyNarrative(text)                      |
|  lib/coercion.ts  scoreCoercion(signals, thresholdShift) -> score, tiers       |
|  lib/taint.ts     buildTree, propagateTaint (haircut + hop cap + floor)        |
|  lib/attestation.ts attested-call registry                                     |
|  lib/immunity.ts  immune registry, reputation, campaign detection              |
|  lib/llm.ts       optional wording enhancer behind OPENROUTER_API_KEY (3 s cap)  |
|  lib/cardModel.ts walks XGBoost trees from src/data/card-model.json (no Python) |
|  lib/media.ts, lenders.ts, agent.ts  simulated registries and the booking agent  |
+-------------------------------------------------------------------------------+
   client-only: lib/hesitation.ts (keystroke timing -> index; runs in the browser,
   raw timings never leave the device)
```

## One request, end to end (Beat 3, the coerced payment)

1. `/phone` measures typing on the amount field (client). On Continue it builds `signals = {callActive, remoteApp, newPayee, pastedVpa, appSwitches, hesitationIndex}` and POSTs `action: pay.review`.
2. Route handler validates the body (zod), checks the role header is `phone`, calls the reducer.
3. Reducer calls `scoreCoercion(signals, user.thresholdShift)` -> `{score, breakdown, tier}`. Tier HOLD sets `payment.stage = "interview"`, appends event `payment.held`, bumps `version`.
4. All four screens see the new version on their next poll. `/phone` renders the interview; `/stage` renders the Coercion tab; `/guardian` stays idle until the answer arrives.
5. `/phone` POSTs `action: interview.answer {text}`. Reducer calls `classifyNarrative(text)` -> `{scam: "digital_arrest", confidence, rebuttal, stat}`; creates a co-sign request; stage `cosign`.
6. `/guardian` POSTs `action: cosign.decide {id, decision: "veto"}` with role `guardian`. Reducer sets `payment.stage = "vetoed"`. `/phone` shows the result within one poll.

## One failure, end to end

The server process is killed mid-demo. Every screen's poll fails; each shows a "Reconnecting" banner and keeps polling. `npm run dev` restarts in a few seconds with an empty store; the presenter presses Reset then the current beat; the demo continues from that beat. Nothing is persisted on purpose: recovery is a restart plus one click, never a database repair.

## Boundaries and rules

- Single writer: only the reducer mutates state; route handlers never touch it directly.
- Privacy: hesitation timings, mic audio and transcripts of the user's own speech are processed in the browser; only derived values (index, text answer) are posted. Documented in SECURITY.md and enforced by the API schema (there is no field for raw timings).
- Determinism: every classifier is a pure function with tests; the LLM path only rewrites wording and is skipped when the key is absent or the call fails.
- Simulation labelling: every state that stands in for a real rail (bank hold, NCRP filing, attestation, freeze) carries `simulated: true` and the UI renders the tag.


## Card-fraud engine: train once, score everywhere

`ml/train_paysim.py` (Python, offline) downloads PaySim, engineers 14 features, balances the training split with RandomUnderSampler, trains `XGBClassifier`, evaluates on a held-out split and exports the trees, threshold, metrics and 60 parity samples to `src/data/card-model.json`. `src/lib/cardModel.ts` re-implements the feature engineering and walks the trees; `cardModel.test.ts` proves TypeScript probabilities match Python within 1e-4. The stage streams held-out samples through it; no Python runs at demo time.


## Real-time transport

Screens hold one open `GET /api/stream` connection (Server-Sent Events). The reducer calls
`notify()` after every state change, so a payment held on the phone reaches the guardian's
screen in milliseconds instead of on the next poll tick. A 15-second heartbeat keeps phone
radios and proxies from closing an idle connection, and carries the live device count.

If `EventSource` is unavailable or the stream drops, the client falls back to polling
`/api/state` every 1.5 s and retries the stream every 2 s. Each screen shows the transport it
is actually using (Live / Polling / Offline), so nobody has to take the claim on trust.

## Durability

`src/lib/persist.ts` saves the whole state after every change, debounced to 400 ms and always
fire-and-forget so persistence can never slow down or break a payment. Two backends:

- **Firestore** when `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`
  are set: survives restarts and machine changes, shared across devices.
- **A JSON snapshot on disk** otherwise: survives restarts on the demo laptop, needs no account.

On boot the store rehydrates once, non-blocking: it serves the seed immediately and swaps in the
saved state the moment it arrives, then pushes it to every open stream. If both backends fail the
app keeps running from memory, which is why the demo is safe with the venue's wifi down.
