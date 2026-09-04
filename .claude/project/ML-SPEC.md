# Machine learning specification

**Project:** TRACE SHIELD
**Owner:** ml-architecture-agent
**Written during:** phase 5
**Last updated:** 2026-09-04

## Task

Two independent binary classification tasks, both inference-only:
1. **Voice:** audio clip in → {real, fake, uncertain} + confidence out. Feeds
   S6 (media upload verdict) and, implicitly, trust in a live call recording.
2. **Face:** image in → {real, fake} + confidence out. Feeds S7.

A rule-based approach was considered and rejected for these two specifically —
detecting synthetic voice/face artifacts from raw signal is exactly the kind
of pattern a hand-written rule can't reliably catch, unlike the script markers
(S2/S3), which are deliberately rule-based because the pattern there **is**
linguistic structure a rule can express.

## Success metric

No formal held-out evaluation is run (no labelled dataset — see DATASET.md).
Operating threshold: confidence >=0.6 is shown as a definite verdict; below
that, the UI shows "uncertain" rather than forcing a binary call. Cost of a
false "fake" on a real family member's voice is high (could make a legitimate
call look suspicious) — this is why S6/S7 are P1/should-have and explicitly
never gate S1-S5's script-based detection, which is the thing the product
actually depends on.

## Baseline

The acoustic-forensics fallback (`acoustic.ts`) **is** the baseline: measured
features (breath-pause rate, dynamic range, spectral flatness, energy above
8kHz, silence share, clipping) compared against rough real-speech ranges, no
model. It is shipped as a permanent fallback, not discarded once the real
model works — venue wifi may fail, and it is honestly labelled "indicators,
not a trained classifier" rather than presented as equivalent to the model.

## Model

- Voice: `MelodyMachine/Deepfake-audio-detection-V2` (wav2vec2-based),
  ~380MB, served via `transformers` in the FastAPI service.
- Face: `prithivMLmods/Deep-Fake-Detector-v2-Model` (ViT), ~330MB, same
  service. Both run on CPU (no GPU assumed at the venue); target inference
  budget is <3s per request, matching the client's 3s fallback timeout.

## Training

None. Both models are used exactly as published, no fine-tuning. This is a
deliberate PRD decision: the team has no labelled dataset and no time to
build or validate one before the deadline, and training on the wrong data
would be worse than being honest about using a general pretrained checkpoint.

## Evaluation

Manually spot-checked on a handful of known-real and (where obtainable)
known-synthetic sample clips/images before the event, not a formal held-out
metric. Any judge question about rigor is answered honestly: "used as
published, spot-checked, not independently validated — the production path
would be fine-tuning on ASVspoof (audio) and FaceForensics++ (face)."

## Deployment

FastAPI + Uvicorn, `localhost:8000`, loaded once at process start (not
per-request) so the ~700MB combined weight load only happens on server boot.
Fallback when confidence is low or the service is unreachable: `acoustic.ts`
(voice only) or an explicit "unavailable" message (face, S7, no fallback
model exists for this task).

## Monitoring

None needed for a single-demo hackathon deployment — no drift, no retraining
loop, no rollback mechanism beyond restarting the process.
