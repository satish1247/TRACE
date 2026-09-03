# Interface contract

All routes are Next.js route handlers under `/api`. Bodies are JSON validated with zod. Every mutating request carries `x-vivek-role: phone | guardian | stage | presenter`.

## GET /api/stream

Server-Sent Events. Emits `event: state` with `{version, state, now, clients}` immediately on
connect and again on every state change, plus `event: ping` every 15 s. This is the live path;
every screen holds one open connection. No polling involved.

## GET /api/state

Returns `{ version: number, state: State }`. Never fails except when the server is down. Clients poll every 400 ms and re-render only when `version` changes.

## POST /api/action

Body: `{ type: string, payload?: object }`. Response: `{ ok: true, version }` or `{ ok: false, error: string }` (HTTP 400 for validation, 403 for role, 409 for an illegal transition).

| type | role | payload | effect |
|---|---|---|---|
| demo.reset | presenter | - | store := seed |
| demo.beat | presenter | {beat: 0-5} | applies the beat's preconditions |
| call.start | presenter | {scenario?: "digital_arrest" or "attested_bank"} | call.active, cursor 0 |
| call.advance | stage or presenter | - | reveals next transcript line, scores it, updates markers, risk, fingerprint, attestation line |
| call.stop | presenter or phone | - | call.active false, ended user_end |
| call.liveLine | stage | {text} | scores a live mic line like a scripted one |
| call.conference | phone | - | conferenced true; scripted caller disconnects; guardian shows joined |
| device.remoteApp | presenter | {app: string or null} | sets remoteAccessApp |
| device.appSwitch | phone | - | increments appSwitches |
| pay.select | phone | {payeeId or {vpa, pasted}} | payment.stage composing |
| pay.review | phone | {amount, signals} | immune check; score; tier; stage review / check / interview / stop |
| pay.check | phone | {knownBefore: bool} | soft-check answer; continue or escalate |
| pay.pin | phone | {pin} | 4471 -> success (if tier allows) ; 9999 -> verifying + hold + guardian alert + interview |
| interview.answer | phone | {text} | classification; creates co-sign request; stage cosign |
| cosign.decide | guardian | {id, decision: approve or veto} | stage success or vetoed |
| trace.start | presenter | {amount} | builds tree, starts clock |
| trace.advance | presenter or stage | - | reveals next hop; propagates taint; places holds |
| incident.confirm | presenter | - | publishes immune entries and signature; builds evidence pack |
| drill.start | presenter | - | rehearsal call |
| drill.choose | phone | {choice: comply or hangup or ask} | lesson and threshold shift |
| search.query | phone | {q} | verified-link shield event |

## POST /api/classify

Body `{text}`. Returns `{scam, label, confidence, rebuttal, stat, source, markers}`. Pure; identical result offline.

## POST /api/screen

Body `{text}`. Returns `{markers: MarkerHit[], riskDelta}`. Pure.

## GET /api/evidence

Returns the evidence pack `{incidentId, victim, timeline[], holds[], immune[], ncrp, cfcfrms, str, simulated: true}` or 404 before confirmation.

## Payment state machine

idle -> composing -> review -> (allow) pin -> success
                            -> (check) softcheck -> pin | interview
                            -> (hold) interview -> cosign -> success | vetoed
                            -> (stop) stopped
review -> blocked (immune VPA)   pin(duress) -> verifying -> interview -> cosign ...

## Coercion thresholds

score 0-100. allow < 25 <= check < 50 <= hold < 80 <= stop. `thresholdShift` from rehearsal moves all three boundaries together (negative = earlier intervention).
