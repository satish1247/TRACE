# Dataset

**Project:** TRACE SHIELD
**Owner:** dataset-agent
**Written during:** phase 5
**Last updated:** 2026-09-04

No dataset is collected or owned by SHIELD — both deepfake models are used
pretrained, off the shelf (see ML-SPEC.md, "Training: none"). This document
records what SHIELD does use as reference/demo data.

## Sources

- **Demo transcript scripts** (written by the team, not scraped): a small set
  of canned digital-arrest / courier / bank-fraud call scripts used for the
  "simulate scripted call" demo button and for unit tests of `markers.ts` and
  `taxonomy.ts`. Original text, no licensing concern.
- **Sample audio/image clips for manual spot-check** (S6/S7 sanity testing
  only, not training): a few public-domain or self-recorded voice clips and
  face images, gathered before the event. Not redistributed, not committed to
  the repo if any carries an unclear license — only synthetic/self-recorded
  samples go in `shield-ml/samples/` if committed at all.
- **Pretrained model weights**: `MelodyMachine/Deepfake-audio-detection-V2`
  and `prithivMLmods/Deep-Fake-Detector-v2-Model`, downloaded from Hugging
  Face under their published licenses, cached locally before the venue.

## Contents

Demo scripts: ~8-12 short scripted calls, one per scam family in
`taxonomy.ts`, each 5-15 lines, hand-written to exercise the five markers in a
realistic order. Spot-check clips: a handful (<20) of short audio/image
samples, not a statistically meaningful set — used only to sanity-check that
the model service returns sane verdicts before the demo, not to measure
accuracy.

## Labelling

Demo scripts are self-labelling by construction (written to contain specific
markers/scam family on purpose). Spot-check clips are labelled by the team
member who sourced them ("this is a real recording of my own voice," "this is
a known-synthetic sample from a public TTS demo") — informal, not a
labelling pipeline, and not used for any metric in ML-SPEC.md.

## Splits

Not applicable — no training happens, so there is no train/val/test split to
protect from leakage.

## Known bias and gaps

- Demo scripts are in English only; the five-marker phrasing patterns in
  `markers.ts` are tuned to English phrasing and will under-detect scripts in
  other languages — a known limitation, not addressed for this hackathon.
- Spot-check clips skew toward clearly-real or clearly-synthetic examples;
  the models' behavior on ambiguous, low-quality, or noisy real-world audio
  (a real phone call, not a clean recording) is untested.
- Pretrained models carry whatever bias exists in their original training
  data (not characterized here — inherited, not something SHIELD can audit
  without access to that data).

## Privacy

No real callers, no real victims — all transcript content used in the demo
and in tests is either scripted by the team or a scam script pattern already
public knowledge. Self-recorded spot-check clips are the team member's own
voice/face, used locally, not uploaded anywhere beyond `localhost:8000`
during testing, and not committed to the repo.
