# Requirements

**Project:** TRACE SHIELD
**Owner:** requirements-agent
**Written during:** phase 2
**Last updated:** 2026-09-04

The agreed scope, sourced from `PRD-1-SHIELD.md` (team-provided) and
`SCHEMA.md` (the shared contract). Every requirement below is recorded in
`state.json` via `pf_state.py req add` and is traced through implementation
and tests in `TRACEABILITY.md`.

## Functional requirements

| ID | Requirement | Priority | Source |
|---|---|---|---|
| S1 | Live transcription via Web Speech API in Chrome; words appear as spoken; typed fallback always present | must | user |
| S2 | Five scam-script markers (authority, threat, isolation, demand, blocking) score risk 0-100, weighted, capped, monotonically non-decreasing during a call | must | user |
| S3 | Deterministic offline scam taxonomy names the call among >=8 scam families with a sourced statistic | must | user |
| S4 | Interview flow (not a warning banner): ask who the money is for and why, classify the answer, name the exact scam back | must | user |
| S5 | Writes `calls` and `detections` to Firestore; another screen subscribed via `onSnapshot` sees the update within one second | must | user |
| S6 | Upload audio -> real/fake verdict via pretrained wav2vec2 model or offline acoustic-forensics fallback with measured numbers shown | should | user |
| S7 | Upload image -> real/fake verdict via pretrained ViT face-deepfake model with confidence shown | should | user |
| S8 | Caller Attestation: an unattested authority claim is shown as "no police unit has attested a call to you" | should | user |
| S9 | Live risk meter 0-100 visible with each of the five markers lighting individually as detected | must | user |

## Non-functional requirements

| ID | Requirement | Priority |
|---|---|---|
| C3 | Model weights for voice/face deepfake detection are downloaded and cached before the event; app degrades to the acoustic fallback if the model service or wifi is down | should |
| C4 | Every classifier (markers, taxonomy) is pure and deterministic, unit-testable without network or ML models | must |

Performance: risk score and marker lamps update within one UI frame of a new
transcript line (no perceptible lag reading a script live).
Offline: S1-S5 and S9 (and S6/S7 via the acoustic fallback) must work with
wifi off. Only the real model-based S6/S7 verdict genuinely needs the local
FastAPI service.

## Constraints

| ID | Constraint | Priority |
|---|---|---|
| C1 | SHIELD writes only to its own Firestore collections (`calls`, `detections`); reads `users`; never writes another module's collection | must |
| C2 | Never run two microphone consumers (recorder + recogniser) at the same time | must |

Fixed by the shared contract (`SCHEMA.md`): document shapes for `calls` and
`detections` are not SHIELD's to change unilaterally — any change needs
agreement with TRACK and AGENT's owners.

## Out of scope

- Model training (pretrained weights only) — no labelled dataset, no time.
- `/pay`, `/dashboard`, `/agent` routes and the shared portal `/` — owned by
  teammates (TRACK, AGENT, Portal).
- Real telephony/carrier integration.
- Accounts/auth beyond the shared `users` collection already seeded by the team.

## Acceptance criteria

| ID | Proof |
|---|---|
| S1 | Speak into the mic on `/shield` in Chrome on `localhost`; transcript lines appear as spoken. Kill mic permission; typed input still produces transcript lines and still drives S2-S4. |
| S2 | Feed a scripted digital-arrest transcript through the marker scorer; all five lamps light in the scripted order and risk only increases, never decreases, ending > 45. |
| S3 | Same transcript resolves to a named scam family (e.g. `digital_arrest`) with a shown statistic, computed with no network call. |
| S4 | After risk crosses the warn threshold, the interview question appears; a spoken/typed answer like "I'm paying my nephew's bail" is classified and the UI names the scam back in one sentence. |
| S5 | With a second browser tab/window open on a `calls` listener, speaking the scripted call causes a `calls` document to appear/update there within 1s, no refresh. |
| S6 | Upload a sample voice clip; get a verdict + confidence from the FastAPI model, or (service down) from the acoustic fallback, with the underlying numbers (pause rate, spectral flatness, etc.) shown and labelled "indicators, not a trained classifier" in the fallback case. |
| S7 | Upload a sample face image; get a verdict + confidence from the ViT model. |
| S8 | A transcript containing an authority claim with no matching attestation record shows the "no police unit has attested a call to you" line. |
| S9 | The risk dial and five marker lamps are visible and update live throughout a call on `/shield`. |
