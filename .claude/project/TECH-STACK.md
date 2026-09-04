# Technology stack

**Project:** TRACE SHIELD
**Owner:** technology-stack-agent
**Written during:** phase 6
**Last updated:** 2026-09-04

## Chosen stack

| Layer | Choice | Version | Why | Alternative rejected |
|---|---|---|---|---|
| Framework | Next.js (App Router) | ^15.3 | Already the repo's stack (`package.json`); zero setup cost, team already knows it | New Vite SPA — would fragment tooling across modules |
| UI | React + TypeScript strict | ^19 / ^5.6 | Matches repo; strict mode catches the transcript/marker type bugs before demo | JS — no, strict TS already the house rule |
| Styling | Tailwind CSS | ^4.1 | Already installed; fast to build a risk dial / lamp UI without a design system | CSS modules — slower for a 2-screen build |
| Realtime data | Firebase Firestore (client SDK) | `firebase` (to add) | S5 requires cross-module realtime; team already owns project `trace-180` | Custom WebSocket server — reinvents what Firestore gives free |
| Live transcription | Web Speech API (browser-native) | n/a | PRD mandates it; zero backend, zero latency | Whisper API — costs money, adds network dependency mid-call |
| Deepfake voice | `MelodyMachine/Deepfake-audio-detection-V2` (wav2vec2) via HF `transformers` | pinned at setup | PRD-specified pretrained model; no training data/time | Train our own — explicitly ruled out by the PRD |
| Deepfake face | `prithivMLmods/Deep-Fake-Detector-v2-Model` (ViT) via HF `transformers` | pinned at setup | PRD-specified pretrained model | Same as above |
| Model server | FastAPI + Uvicorn (Python) | 3.12 (already installed) | PRD-specified; `transformers`/`torch` are Python-native, keeps Next.js free of a 2GB+ ML dependency | Node ONNX runtime — far less model availability for these two checkpoints |
| Tests | Vitest | ^3.0 | Already the repo's test runner | Jest — no reason to diverge from repo convention |
| Package manager | npm | 10.9 (installed) | Matches `package-lock.json` already committed | pnpm/yarn — would require a fresh lockfile |

## Fit to constraints

Team of three sharing one repo on a hard deadline: reusing the already-chosen
Next.js/TS/Tailwind/Vitest toolchain means zero new build tooling to debug
under time pressure. The one new piece (FastAPI model server) is isolated in
its own directory (`shield-ml/`) and is optional at runtime, so its setup
(Python deps, ~700MB model download) can happen in parallel with the frontend
work without blocking it.

## What this rules out

- No server-side rendering of live call state (Firestore listeners are
  client-only) — fine, this is a live single-user screen, not a page that
  needs to be crawlable.
- No offline model inference without the FastAPI service running — mitigated
  by the mandatory acoustic fallback (C3).
- Web Speech API ties live transcription to Chrome on a secure origin — known
  trap from the PRD, mitigated by the typed fallback (S1).

## Local setup

```bash
npm install                 # adds firebase to package.json dependencies
cp .env.example .env.local  # fill NEXT_PUBLIC_FIREBASE_* from the trace-180 web app config
npm run dev                 # http://localhost:3000/shield

# optional, for real (non-fallback) S6/S7:
cd shield-ml
python -m venv .venv && .venv\Scripts\activate     # Windows
pip install -r requirements.txt
python download_models.py    # caches both HF checkpoints locally, run before the venue
uvicorn main:app --port 8000
```
