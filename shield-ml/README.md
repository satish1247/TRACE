# SHIELD ML service

Small local FastAPI service that runs two pretrained Hugging Face models
(no training) to detect deepfake/cloned face images and voice audio. Backs
`S6`/`S7` of PRD-1-SHIELD.md. Independent of the Next.js app in the repo
root — this is its own Python service, called over HTTP.

## Setup

```bash
cd shield-ml
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

If you want the smaller CPU-only PyTorch wheel instead of whatever pip
resolves by default, install torch from the CPU index first:

```bash
pip install torch==2.5.1 --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
```

## Download model weights (run once, needs network, ~700MB)

```bash
python download_models.py
```

Run this once ahead of time, with a working internet connection — ideally
before the hackathon venue, since venue wifi may fail. It caches both
checkpoints in the local Hugging Face cache (`~/.cache/huggingface` by
default) so `main.py` never needs network access afterwards.

## Run the service

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

The Next.js frontend expects this service at `http://localhost:8000`. It's
fine to skip this whole service for local frontend dev — the frontend
treats a non-200 response or a >3s timeout as "service unavailable": the
voice path (`/detect/voice`) falls back to the in-browser acoustic
forensics method (`acoustic.ts`), and the face path (`/detect/face`) simply
shows an "unavailable" message (no browser-side face fallback exists).

## Endpoints

- `GET /health` — `{"status", "face_model_loaded", "voice_model_loaded", ...}`
- `POST /detect/face` — multipart field `file` (jpeg/png, <=10MB) →
  `{"verdict": "real"|"fake", "confidence": <float 0-1>, "model": "prithivMLmods/Deep-Fake-Detector-v2-Model"}`
- `POST /detect/voice` — multipart field `file` (wav/mp3, <=15MB) →
  `{"verdict": "real"|"fake", "confidence": <float 0-1>, "model": "MelodyMachine/Deepfake-audio-detection-V2"}`

Full contract: `.claude/project/API.md` in the repo root.
