# Requirements

Priorities: **must** ships for the five demo beats; **should** ships once the beats work; **could** is roadmap unless time is abundant. All must and should requirements are AGREED under ASM-001 (the user delegated sign-off: "forget me, I want to win"). Could-haves are agreed as scope, not as commitments.

## Must

| ID | Requirement | Acceptance criterion |
|---|---|---|
| REQ-001 | Ordinary payment, zero friction | Lakshmi pays the known kirana VPA; no panel, no prompt, no delay beyond normal; Coercion Score visibly low |
| REQ-002 | Call screening on the script | The scripted digital-arrest call lights up each of the five markers as its line appears; a live mic line (Chrome) is scored the same way; risk never decreases during the call |
| REQ-003 | Coercion Score with visible breakdown | Score is the weighted sum of active call, remote-access app, first-time payee, pasted VPA, app-switch count and hesitation index; each contribution is shown |
| REQ-004 | Graduated response | Four tiers with fixed thresholds; tier shown; hard stop only above the top threshold |
| REQ-005 | Voice interview and named rebuttal | Held payment asks the question; speech (Web Speech) or typed answer; deterministic taxonomy match returns scam name, rebuttal and sourced statistic; works with wifi off |
| REQ-006 | Trusted Circle co-sign | Guardian screen receives payee, amount, score, markers and the interview answer; approve or veto changes the phone within one poll interval |
| REQ-007 | Retrieval tree and golden hour | From Rs 50,000 stolen, a tree of at least four layers renders progressively under a countdown; settlement points are marked |
| REQ-008 | Proportional Freeze | Ledger per account shows received, balance, taint, held, free; tea-shop/customer case yields Rs 20 held and Rs 0 held; unit-tested |
| REQ-009 | Network immunity | After confirmation, a payment to the mule VPA is blocked before it starts, with the reason and time since report; network view lists immune VPAs and script signatures |
| REQ-010 | Offline determinism | All classifiers run without network; LLM key optional |
| REQ-011 | Single runtime, one command, reset | `npm run dev` starts everything; presenter reset returns all screens to beat 0 |
| REQ-012 | Presenter panel | Buttons for beats 1-5, reset, and live toggles (start call, remote app on/off, inject payee) |
| REQ-022 | Caller Attestation | An active call with an authority claim and no attestation shows the "not who they say they are" line on the phone; an attested demo call from the real bank shows its code |
| REQ-023 | Duress PIN | Entering the duress PIN shows a true "under verification" receipt with reference and window, holds funds, alerts the guardian and starts the interview |

## Should

| ID | Requirement | Acceptance criterion |
|---|---|---|
| REQ-013 | Verified-link shield | Typing a customer-care intent in the in-app search shows the verified number and in-app help before any results |
| REQ-014 | Evidence pack | Confirmed incident renders an NCRP / CFCFRMS / STR-format report; needs a human confirm; labelled simulated |
| REQ-015 | Caller reputation | A number flagged on one user shows as flagged on the next simulated call |
| REQ-016 | Privacy by construction | Coercion signals are computed in the browser; the API receives only score and breakdown; documented and enforced in code |
| REQ-017 | Phone width and projector, large text, keyboard | Screens usable at 390px and 1920px; large-text toggle; tab order works |
| REQ-024 | Scam Rehearsal | Drill mode runs a simulated call; outcome shown as a lesson; the user's threshold shift changes and is visible |
| REQ-025 | Un-isolate conference | "Add Priya to this call" makes the guardian screen show joined and the scripted scammer disconnect |
| REQ-026 | Campaign detection | Simulated fingerprint counts over a window raise network thresholds and name the campaign on the network view |

## Could (built after the six beats)

REQ-018 synthetic-media indicator on curated samples (built, simulated); REQ-019 loan-app checkpoint (built, simulated registry); REQ-020 guided booking agent within a limit (built, simulated); REQ-021 card-fraud engine (built: PaySim XGBoost scored in TypeScript) and crypto off-ramp note in the evidence pack (built; full tracing remains roadmap).

## Non-functional

Determinism offline (REQ-010); privacy (REQ-016); accessibility (REQ-017); every simulated rail labelled on screen (ASM-002); reset under two seconds; no step of the stage demo depends on a network round trip.
