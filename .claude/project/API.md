# Interface contract

**Project:** TRACE SHIELD
**Owner:** backend-agent
**Written during:** phase 7
**Last updated:** 2026-09-04

## Conventions

Base path for the model service: `http://localhost:8000`. No auth (localhost
only, hackathon demo). JSON responses, `multipart/form-data` requests for file
upload. No versioning, no pagination. Timestamps elsewhere in the system are
epoch milliseconds (matches `SCHEMA.md`).

## Endpoints (shield-ml FastAPI service)

### POST /detect/face
- Auth: none (localhost only)
- Request: `multipart/form-data`, field `file`: image (jpeg/png, <=10MB)
- Response 200: `{ "verdict": "real"|"fake", "confidence": number, "model": "prithivMLmods/Deep-Fake-Detector-v2-Model" }`
- Errors: 400 (missing/invalid file), 415 (unsupported type), 500 (model load
  failure) — the Next.js client treats any non-200 or timeout (>3s) as
  "service unavailable," not a hard error, and does not fall back to the
  acoustic method for face (no browser-side face fallback exists — S7 simply
  shows "model service unavailable, retry").

### POST /detect/voice
- Auth: none (localhost only)
- Request: `multipart/form-data`, field `file`: audio (wav/mp3, <=15MB)
- Response 200: `{ "verdict": "real"|"fake", "confidence": number, "model": "MelodyMachine/Deepfake-audio-detection-V2" }`
- Errors: same as above. On unavailability/timeout, the client falls back to
  `acoustic.ts` and labels the result "indicators, not a trained classifier."

## Firestore "API" (client SDK, no REST layer)

SHIELD does not expose a custom backend API for `calls`/`detections` — the
Next.js client writes to Firestore directly through `src/lib/shield/firestore.ts`,
gated by Firestore security rules (see DATABASE.md, C1). This is a deliberate
simplification for the demo: no server round-trip between "risk changed" and
"teammate's screen updates."

`firestore.ts` exposes (in-process, not HTTP):
- `writeCall(callId: string, patch: Partial<Call>): Promise<void>`
- `writeDetection(detection: Detection): Promise<string>` (returns new doc id)
- `subscribeToCall(callId: string, onChange: (call: Call) => void): Unsubscribe`

## Events and messages

None beyond Firestore's own `onSnapshot` push mechanism — no queue, no
webhook, no MQTT. TRACK and AGENT's screens are simply other `onSnapshot`
subscribers on `calls`.

## Backwards compatibility

The FastAPI endpoints and the `calls`/`detections` shapes are frozen for the
duration of the hackathon; any change is a conversation with the other two
module owners first (per `SCHEMA.md`), not a unilateral edit.
