# System architecture

**Project:** TRACE SHIELD
**Owner:** system-architecture-agent
**Written during:** phase 5
**Last updated:** 2026-09-04

## Context

SHIELD is a Next.js route group (`/shield`, `/shield/media`) inside the shared
`trace-180` repo. It runs entirely client-side except for one small server
boundary (deepfake model inference, which cannot run in-browser). It talks to:

- **Browser Web Speech API** — live transcription (no network, in-browser).
- **Firebase Firestore** (`trace-180` project) — writes `calls`, `detections`;
  reads `users`. Shared with TRACK and AGENT, who read what SHIELD writes.
- **Local FastAPI service** (`localhost:8000`) — optional; wraps two pretrained
  HF models (face deepfake ViT, voice deepfake wav2vec2). SHIELD's UI never
  blocks on it: if it's unreachable, the browser-side acoustic fallback runs
  instead.

```
 browser (mic / typed input)
        |
        v
  useTranscript() ---> markers.ts (score) ---> taxonomy.ts (name it)
        |                    |                        |
        v                    v                        v
  /shield UI  <--------  risk state  ------->  interview.ts (verdict)
        |
        v
  firestore.ts --writes--> Firestore: calls, detections
                                    ^
                                    | onSnapshot (read-only, other members' screens)
                            TRACK's /dashboard, AGENT's /agent

  /shield/media UI --upload--> POST localhost:8000/detect/{face,voice}
        |                              |
        | (unreachable/timeout)        v
        +----------------------> acoustic.ts fallback (in-browser)
```

## Components

- **`src/app/shield/page.tsx`** — the live-call screen: transcript, five
  marker lamps, risk dial, verdict/interview card. Owns nothing but rendering
  and wiring hooks together; must never call Firestore directly.
- **`src/app/shield/media/page.tsx`** — upload screen for S6/S7.
- **`src/lib/shield/markers.ts`** — pure function: transcript lines in, `{risk,
  markers[]}` out. No I/O, no React. This is what C4 requires be unit-tested.
- **`src/lib/shield/taxonomy.ts`** — pure function: transcript + markers in,
  scam family + statistic out.
- **`src/lib/shield/interview.ts`** — pure function: free-text answer in,
  classification + rebuttal sentence out.
- **`src/lib/shield/attestation.ts`** — pure lookup against a small hardcoded
  "attested calls" registry (SIMULATED, labelled as such on screen).
- **`src/lib/shield/acoustic.ts`** — in-browser feature extraction (Web Audio
  API) for the offline fallback; pure given an `AudioBuffer`.
- **`src/lib/shield/firestore.ts`** — the only file allowed to touch
  Firestore. Exposes `writeCall`, `writeDetection`, `subscribeToCall`. Nothing
  else in SHIELD imports `firebase/firestore` directly.
- **`src/lib/shield/speech.ts`** — thin wrapper around
  `webkitSpeechRecognition`/`SpeechRecognition`, with a typed-input fallback
  path that produces the exact same transcript-line shape.
- **`shield-ml/` (FastAPI)** — `/detect/face`, `/detect/voice`. Stateless,
  local-only, never required for the demo to run.

## Data flow

**Happy path (S1→S5):** user speaks → `speech.ts` emits a transcript line →
`markers.ts` recomputes `{risk, markers}` (pure, synchronous) → UI re-renders
lamps/dial instantly → `taxonomy.ts` recomputes the named family → once risk
crosses 45, `interview.ts` prompts and classifies the answer → every state
change also calls `firestore.ts#writeCall` (debounced ~300ms) → Firestore
`calls/{callId}` updates → any other screen (TRACK's dashboard) with an
`onSnapshot` listener on that document receives the update, typically
<300ms on the same network.

**Failure path:** Web Speech unsupported/denied → `speech.ts` reports
`unsupported`, UI switches to the always-present typed-input box, everything
downstream is unaffected because it only ever sees "transcript lines," not
"where they came from." Firestore write fails (offline, quota, bad rules) →
`firestore.ts` catches, UI shows "not syncing — teammates won't see this call"
without blocking local detection, and retries with backoff.

## Key decisions

1. **Two independent engines (script vs. media), not one.** Rejected: a single
   "AI risk score." Reason: script markers are instant/explainable/offline and
   catch the ~90% non-cloned scams; a deepfake check alone would sit there
   detecting nothing on a real human scammer. Keeping them independent lets S1-S5
   work with zero ML dependency.
2. **Firestore write isolated to one file (`firestore.ts`).** Rejected:
   calling Firestore from components. Reason: C1 ("never write to a collection
   you do not own") is only enforceable if there is exactly one place writes
   happen, so it can be code-reviewed and — later — matched to security rules.
3. **Acoustic fallback is a first-class path, not an error state.** Rejected:
   showing "model unavailable" and stopping. Reason: venue wifi may fail; S6/S7
   must still return *something* measured, honestly labelled.
4. **New `src/lib/shield/*` namespace, not the existing `src/lib/*.ts`.** The
   repo's `main` branch already has `screening.ts`/`taxonomy.ts`/etc. for a
   different, already-shipped unified app. SHIELD is being built as its own
   module per the team's original per-member plan, so it does not modify or
   depend on those files — new files, new routes, same repo/toolchain.

## Cross-cutting concerns

- **Auth:** none built by SHIELD. Reads the pre-seeded `users` collection by
  uid; no login flow, no session management (out of scope, owned elsewhere).
- **Authorization:** enforced by Firestore security rules restricting writes
  to `calls`/`detections` per C1 — declared in `firestore.rules` (shared file,
  additive only).
- **Logging:** `console.error` only, on the Firestore-write and model-service
  failure paths; nothing else logs, per no-console.log-in-prod convention for
  anything not an actual error.
- **Config/secrets:** Firebase web config lives in `NEXT_PUBLIC_FIREBASE_*` env
  vars (public by design for Firebase web apps; access is controlled by
  security rules, not by hiding the key). No server secrets in this module.
- **Background work:** none. Everything is request/response or a live
  `onSnapshot` subscription.

## Scale and failure

This is a hackathon demo for one call at a time, not a production system.
Explicitly handled: mic permission denied, Web Speech unsupported (non-Chrome),
Firestore unreachable, model service unreachable/slow (>3s timeout → fallback),
uploaded file too large/wrong type. Not handled and not needed: concurrent
calls from the same browser tab, horizontal scaling, retention policy beyond
the hackathon.
