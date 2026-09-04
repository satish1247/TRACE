# TRACE handoff

For someone who has never seen this conversation.

## What it is

A prototype for Innovation Unbound Round 2 (VIT Chennai), Problem Statement 1. It protects elderly and first-time digital users from social-engineering fraud by watching the person, not the payment: a live call, a screen-share app, hesitant typing, the words "don't tell anyone". It interviews instead of warning, names the scam, asks a guardian, traces stolen money in the golden hour, freezes only the tainted amount, and immunises the network. It also carries a card-fraud engine trained on PaySim and scored in the app runtime, a synthetic-media indicator, a loan-app checkpoint, a guided booking agent, and an optional LLM wording enhancer.

## Run

```bash
npm install && npm run build && npm start
```

Open http://localhost:3000. Presenter → Reset → Beat 1. PINs 4471 (real) and 9999 (duress). Details in README.md and DEPLOYMENT.md.

## Where things are

- `src/lib/` engines and the store: `screening`, `taxonomy`, `coercion`, `hesitation`, `taint`, `attestation`, `immunity`, `cardModel`, `media`, `lenders`, `agent`, `llm`, `store`, `scenario`
- `src/app/` screens: `phone`, `guardian`, `stage`, `presenter`; API under `src/app/api`
- `src/data/card-model.json` the exported XGBoost model; regenerate with `npm run train:card` (downloads about 490 MB once)
- `.claude/project/` all design and verification documents; `.claude/state/` machine-checked status

## What is real, what is simulated

Real and unit-tested: every engine above, the state machine, the four screens. Simulated and labelled on screen: bank ledger and UPI rails, attestation, lender and immunity registries, freeze execution, NCRP/CFCFRMS/FIU-IND filings, the synthetic-media detector. The card model's numbers (99.6% recall, ROC-AUC 1.000) are real held-out results on synthetic PaySim data, which is easier than real bank data.

## Decisions worth knowing

One runtime on stage; nothing depends on the network; Python trains offline and TypeScript scores. Firebase deliberately not used (laptop + hotspot). Requirements were signed off by delegation from the user; see ASSUMPTIONS.md.

## Open items

None blocking the demo. Roadmap: crypto tracing beyond the off-ramp note, a real attestation protocol with NPCI, threshold tuning from rehearsal data at scale.
