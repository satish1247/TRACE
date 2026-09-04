# PRD 1 — SHIELD · Prevention

**Owner: Member 1** · Routes `/shield/*` · Writes `calls`, `detections`

Read `docs/SCHEMA.md` first. Never write to a collection you do not own.

## What you are building

Answer one question in real time: **is the caller who they claim to be, and is this a scam?**
Two independent engines, because they fail in different ways.

- **Engine A, the script.** Reads what the call is *doing*. Catches the ~90% of scams that use no
  cloning at all. Instant, offline, explainable.
- **Engine B, the media.** Detects a cloned voice or face. Slower, model-based, and never the thing
  the product depends on.

> Say on stage: *"Most scam calls use a real human voice. A deepfake detector alone would sit there
> detecting nothing. So we read the script first and check the media second."*

## The scam script: five markers

| # | Marker | Typical phrasing | Weight |
|---|---|---|---|
| 1 | Authority claim | police, CBI, TRAI, courier, bank, electricity board | 15 |
| 2 | Manufactured threat | arrest, warrant, disconnection, account block | 20 |
| 3 | **Isolation instruction** | **"Stay on the call. Don't tell your family."** | **30** |
| 4 | Payment or credential demand | UPI transfer, OTP, PIN, install AnyDesk | 20 |
| 5 | Verification blocking | "Don't call the bank. Ignore the warning." | 25 |

First hit of a marker scores full weight; repeats add 3. Cap 100. Warn at **45**.

Marker 3 is the strongest signal in the product. No bank, police officer or company has ever
legitimately told a customer to stay on the line and not tell their family.

**Do not build a warning banner.** The scam script pre-inoculates the victim: *"the app will show a
warning, ignore it, it's a system error."* Instead **interview**: ask "In your own words, who is
this money for, and why?", classify the spoken answer, and name the exact scam back.

## Clone detection: use pretrained, do not train

You have no labelled dataset and no time. Training today is the wrong call.

| Need | Model | Size | Returns |
|---|---|---|---|
| Face / image | `prithivMLmods/Deep-Fake-Detector-v2-Model` (ViT) | ~330 MB | real/fake + confidence |
| Voice | `MelodyMachine/Deepfake-audio-detection-V2` (wav2vec2) | ~380 MB | real/fake + confidence |
| Fallback | in-browser acoustic forensics | 0 | measured features |

Serve them from a small **FastAPI** service on `localhost:8000`:

```
POST /detect/face   multipart image  → {verdict, confidence, model}
POST /detect/voice  multipart audio  → {verdict, confidence, model}
```

**Download the weights before the venue and cache them.** Assume venue wifi fails.

### The offline fallback that always works

If the model service is down, measure real acoustic features in the browser: breath-pause rate,
dynamic range, spectral flatness, energy above 8 kHz, silence share, clipping. Real speech and most
synthesis genuinely differ on these.

**Label it on screen: "indicators, not a trained classifier."** An ML-literate judge will ask, and
the true answer scores higher than a claim you cannot defend. Name ASVspoof and FaceForensics++ as
the production training path.

## Requirements

| ID | Requirement | Acceptance test | Pri |
|---|---|---|---|
| S1 | Live transcription | Web Speech in Chrome; words appear as spoken; typed fallback always present | P0 |
| S2 | Five markers, rising risk | Scripted call lights all five in order; risk never decreases | P0 |
| S3 | Scam taxonomy | ≥8 families; names the scam with a sourced statistic; deterministic, offline | P0 |
| S4 | The interview, not a warning | Spoken or typed answer; exact scam named back | P0 |
| S5 | Writes `calls` and `detections` | Another member's screen updates via onSnapshot within a second | P0 |
| S6 | Upload audio → real/fake | Model verdict, or acoustic fallback, with numbers shown | P1 |
| S7 | Upload image → real/fake | Face model verdict with confidence | P1 |
| S8 | Caller Attestation | Unattested authority claim shown as "no police unit has attested a call to you" | P1 |
| S9 | Live risk meter | Visible 0–100 with the five markers lighting individually | P0 |

## Screens

- `/shield` — transcript left; five marker lamps and risk dial right; verdict card below
- `/shield/media` — upload audio or image, playback, verdict with every measured number

## Traps

1. **Web Speech needs Chrome and a secure origin.** `localhost` works, `http://192.168.x.x` does
   not. Always ship the typed fallback.
2. **Never run two microphone consumers at once.** A recorder and a recogniser steal the mic from
   each other and you get silence.
3. Download model weights before the event.
4. Keep classifiers pure and deterministic so you can unit-test them.

## Done when

Speaking a digital-arrest script drives risk past 45, names the scam, writes a `calls` document,
and Member 2's dashboard sees it appear without a refresh.
