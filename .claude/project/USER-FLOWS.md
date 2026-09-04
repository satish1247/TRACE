# User flows

**Project:** TRACE SHIELD
**Owner:** ux-flow-agent
**Written during:** phase 4
**Last updated:** 2026-09-04

## Roles

Single role: **the person on the call** (no accounts). Implicit secondary
"role": teammates' modules reading `calls` — they never act inside SHIELD's UI.

## Primary flows

**A. Live scam call (S1→S5, S9)**
1. Open `/shield`. Empty state: "Say something or type below to begin."
2. Tap "Start listening" → mic permission prompt (first time).
3. Granted → transcript fills as the caller/user speak. Each line re-runs
   `markers.ts`; risk dial and lamps update live.
4. A marker fires → its lamp lights, risk rises, never falls.
5. Risk crosses 45 → taxonomy names the scam family; interview card appears
   with the question.
6. User speaks or types an answer → `interview.ts` classifies it, verdict
   card shows the named scam and the rebuttal sentence.
7. Throughout, `calls/{callId}` is written on every material change.
8. End state: call marked `active:false` when the user taps "End call"; the
   full transcript/markers/risk/scamType remain in Firestore for TRACK/AGENT.

**B. Same flow, no working mic (S1 fallback)**
1. Open `/shield`, tap "Start listening" → permission denied, or browser
   isn't Chrome (`SpeechRecognition` undefined).
2. UI shows one line: "Microphone blocked. Type what's being said instead,"
   and focuses the typed-input box — flow continues identically from step 3
   above, since `markers.ts`/`taxonomy.ts`/`interview.ts` only ever see
   transcript lines, not their source.

**C. Media check (S6/S7)**
1. Open `/shield/media`, choose "Check audio" or "Check face".
2. Upload a file → loading state, request to `localhost:8000/detect/*`.
3a. Service responds in time → verdict + confidence + model name shown.
3b. Service times out/unreachable (audio only) → falls back to `acoustic.ts`,
    shows measured numbers labelled "indicators, not a trained classifier."
3c. Service unreachable (face) → "Model service unavailable — start it and
    retry" (no browser-side face fallback exists).

## Failure and edge paths

- **No network at all:** S1-S5/S9 still work (all client-side computation);
  Firestore writes queue via the SDK's offline persistence and flush on
  reconnect; `/shield/media` model calls fail fast (3s timeout) into the
  fallback path or the "unavailable" message.
- **Firestore write rejected by security rules** (e.g. malformed payload):
  caught in `firestore.ts`, shown as the "not syncing" banner; never crashes
  the live-detection UI.
- **Empty/garbage transcript:** markers stay unfired, risk stays 0, taxonomy
  reports "no scam pattern detected" rather than guessing.
- **Duplicate marker phrasing repeated:** scored per PRD rule (+3 per repeat,
  capped at 100), not re-triggered as a fresh lamp animation each time.
- **Upload of wrong file type/oversized file:** rejected client-side before
  any network call, with the exact reason shown ("Choose a WAV/MP3 under
  15MB").

## Empty, loading and error states

Covered per-screen in UI-SPEC.md's States section; both screens define all
five (loading/empty/populated/error/submitting) — no undefined state is
allowed to render blank.

## Accessibility notes

Every lamp and the risk dial carry an `aria-label` stating the marker name and
current on/off + numeric risk (not color alone — color-blind and screen-reader
safe). Typed-input fallback is reachable and usable by keyboard alone (tab
order: transcript → typed input → send → interview answer). Transcript panel
is an `aria-live="polite"` region so new lines are announced without
interrupting. Verdict/interview text meets WCAG AA contrast in both light and
dark mode.
