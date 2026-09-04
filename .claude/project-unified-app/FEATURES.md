# Features and release slice

| ID | Feature | Requirements | Pillar | Slice |
|---|---|---|---|---|
| FEAT-001 | Ordinary payment with zero friction | REQ-001, REQ-011 | Protection | Beat 1 |
| FEAT-002 | Call screening on the script | REQ-002, REQ-015 | Protection | Beat 2 |
| FEAT-003 | Coercion Score and graduated response | REQ-003, REQ-004, REQ-016 | Protection | Beat 3 |
| FEAT-004 | Voice interview and named rebuttal | REQ-005, REQ-010 | Protection | Beat 3 |
| FEAT-005 | Trusted Circle co-sign | REQ-006 | Protection | Beat 3 |
| FEAT-006 | Retrieval tree, golden hour and Proportional Freeze | REQ-007, REQ-008 | Retrieval | Beat 4 |
| FEAT-007 | Network immunity and evidence pack | REQ-009, REQ-014 | Precaution | Beat 5 |
| FEAT-008 | Presenter panel and reset | REQ-012, REQ-011 | (stage) | all |
| FEAT-009 | Caller Attestation | REQ-022 | Protection | Beat 2 |
| FEAT-010 | Duress PIN | REQ-023 | Protection | Beat 3 |
| FEAT-011 | Un-isolate conference | REQ-025 | Protection | Beat 2 |
| FEAT-012 | Scam Rehearsal | REQ-024 | Precaution | after beats |
| FEAT-013 | Campaign detection | REQ-026 | Precaution | Beat 5 |
| FEAT-014 | Verified-link shield | REQ-013 | Precaution | after beats |
| FEAT-015 | Large text and accessibility | REQ-017 | (all) | after beats |
| FEAT-016 | Card-fraud engine (PaySim XGBoost, scored in TypeScript) | REQ-021 | Protection | Beat 6 |
| FEAT-017 | Synthetic-media indicator (simulated) | REQ-018 | Protection | Beat 2 |
| FEAT-018 | Loan-app checkpoint | REQ-019 | Protection | after beats |
| FEAT-019 | Guided booking agent within a limit | REQ-020 | Protection | after beats |
| FEAT-020 | OpenRouter wording enhancer (optional) | REQ-010 | Protection | after beats |

## Release slice (the thing that must work end to end)

Beats 1-5 = FEAT-001, 002, 003, 004, 005, 006, 007, 008, 009, 010. This is one usable path from "Lakshmi opens the app" to "the network is immune", operated from the presenter panel. It is built first, in that order, and each beat is walked through end to end before the next begins.

## Second slice

FEAT-011, 013 (both hang off state that already exists), then FEAT-014, 012, 015.

## Built after the first slice

The card-fraud engine, synthetic-media indicator, loan-app checkpoint, booking agent and the crypto off-ramp note in the evidence pack were all built once the six beats worked. Full crypto tracing remains roadmap.
