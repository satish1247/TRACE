# Test plan

## Automated

`npm test` (Vitest) runs 12 files, 63 tests, in under 3 s. `npm run typecheck` runs TypeScript strict.

| File | Covers |
|---|---|
| `screening.test.ts` | five script markers, risk monotonicity and cap, fingerprint stability |
| `taxonomy.test.ts` | scam classification incl. digital arrest, fake customer care, courier, KYC; unknown path; determinism |
| `coercion.test.ts` | tiers, bounded breakdown, threshold shift |
| `hesitation.test.ts` | fluent vs hesitant typing index |
| `taint.test.ts` | Proportional Freeze: ₹20 held / ₹1,99,990 free, ₹10 below floor, hold ≤ balance, purity |
| `immunity.test.ts` | attestation lines, immune registry, campaign threshold |
| `store.test.ts` | the five beats end to end, duress PIN, conference, veto, blocked payment, campaign, evidence pack incl. VASP hold, rehearsal, illegal transitions |
| `scenario.test.ts` | verified-link shield |
| `cardModel.test.ts` | model present with metrics; **TS scores equal Python probabilities within 1e-4 on 60 held-out samples**; fraud flagged / legit cleared; feature identities; explanations |
| `extras.test.ts` | synthetic-media samples, lender checkpoint (store path), booking agent both branches (store path) |
| `llm.test.ts` | enhancer returns null without a key in < 50 ms, null on failure, text on success |
| `a11y.test.ts` | presence of large-text, focus rings, labels, text alongside colour |

## Card-fraud model evaluation (held out, never used in training)

Dataset: PaySim synthetic mobile-money transactions (Kaggle paysim1, HF mirror). Total rows 6,362,620; working set 600,000 with all 8,213 fraud rows; train 480,000 (balanced to 32,850); test 120,000.

| Metric | Value |
|---|---|
| ROC-AUC | 1.0000 |
| PR-AUC | 0.9993 |
| Precision @ threshold 0.932 | 99.9% |
| Recall | 99.6% |
| F1 | 0.998 |
| Confusion (tn / fp / fn / tp) | 118,356 / 1 / 7 / 1,636 |

Caveat stated on stage: PaySim is synthetic and the balance-consistency features make it unusually separable; real card fraud is harder, and these numbers are an upper bound on what this pipeline would do on bank data.

## Manual walkthrough (Chrome on the build laptop)

Beats 1–6 from `/presenter` with `/phone`, `/guardian` and `/stage` open. Verified: known payee sails through; scripted call lights all five markers, risk 100, attestation line shown, conference ends the call; coached payment held, interview classifies digital arrest, guardian veto returns the phone; duress PIN shows the TRC receipt; trace reveals hop by hop with the ₹20 / ₹10 ledger; confirm publishes immunity and the campaign banner; blocked payment message; card tab streams scored transactions with TP/FP/FN/TN badges and the phone shows the held-card sheet.

## Performance

Measured on the build laptop with the dev server: `GET /api/state` is 5 KB at idle (about 40 ms) and stays under 60 KB with the trace tree and card feed loaded; four screens polling every 400 ms is well under 1% CPU. Scoring one card transaction walks 120 trees in under a millisecond. `next build` succeeds; the demo runs from `npm start`.

## Regressions

None open. Every change re-ran the full suite; the one failure during the build (a wrong expected balance in `taint.test.ts`) was a test arithmetic error, corrected and documented.
