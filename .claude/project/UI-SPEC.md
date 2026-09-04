# Interface specification

**Project:** TRACE SHIELD
**Owner:** ui-ux-design-agent
**Written during:** phase 4
**Last updated:** 2026-09-04

## Screens

### `/shield` — the live call screen
Purpose: watch a call happen and see the risk build in real time.
Layout: transcript panel (left, scrolling), five marker lamps + risk dial
(right, always visible), verdict/interview card (below, appears once risk
crosses 45). Data shown: live transcript lines with speaker tag, risk 0-100,
which of the five markers have fired (and in what order), named scam family
once resolved, interview question/answer/verdict. Actions: start/stop
listening, switch to typed input, type an answer to the interview question,
"simulate scripted call" (demo button, runs a canned transcript for judges).
Role: anyone (no auth).

### `/shield/media` — upload screen
Purpose: check a standalone audio/image sample. Data shown: file preview
(playback for audio, thumbnail for image), verdict, confidence, and every
measured number that produced it. Actions: upload audio, upload image, view
result. Role: anyone.

## States

Both screens: **loading** (mic starting / model request in flight — spinner +
"listening…" or "checking…"), **empty** (no transcript yet: "Say something or
type below to begin"; no file yet: "Drop or choose a file"), **populated**
(as above), **error** (mic denied → typed box auto-focused with one line
explaining why; Firestore write failed → a small non-blocking banner, local
detection keeps working; model service down → automatic fallback with a
label, never a dead end), **submitting/disabled** (upload button disabled
mid-request, re-enabled on response or 3s timeout).

## Navigation

`/shield` and `/shield/media` are siblings, linked by a small nav ("Live call"
/ "Check a file") at the top of each. No deep linking beyond the path itself
(no call-id in the URL for this demo — one active call per browser tab).
Back button behaves like any static route change; no custom history handling
needed since there's no multi-step wizard.

## Content and tone

Plain, calm, and specific — never alarmist (the PRD explicitly forbids a
"warning banner" tone). Examples:
- Marker lamp labels: "Authority claim", "Threat", "Isolation instruction",
  "Payment/credential demand", "Verification blocking".
- Interview prompt: "In your own words — who is this money for, and why?"
- Verdict line: "This matches the **digital arrest** scam. {stat}. No police
  officer has ever legitimately told someone to stay on the line and hide it
  from their family."
- Attestation line (S8): "No police unit has attested a call to you."
- Acoustic fallback label: "Indicators, not a trained classifier."
- Firestore error: "Not syncing to your team right now — detection still
  works locally."
- Mic denied: "Microphone blocked. Type what's being said instead."

## Visual direction

Tailwind, dark-capable. Risk dial uses a calm blue→amber→red gradient only as
risk actually rises (never red by default — avoids crying wolf). Marker lamps:
off = neutral gray outline, on = filled color with a one-word label, in fixed
left-to-right order matching the PRD's marker table so a judge can read the
scam's shape at a glance. Monospace numerals for risk score and confidence
values (they're the thing being proven, so they should look measured, not
decorative). The one deliberate touch: marker lamps light up with a brief
pulse animation the instant they fire, so a live demo visibly reacts to
speech as it happens.

## Responsive behaviour

`/shield` on a narrow screen stacks transcript above the dial/lamps (dial
first, since that's the at-a-glance signal), interview card always full width.
Nothing is ever hidden on small screens — the five lamps and risk number are
the whole point and must survive a phone-width demo window.
