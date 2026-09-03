# TRACE

**Banks check whether the payment is correct. TRACE checks whether the person is free.**

A working prototype for Innovation Unbound Round 2 (VIT Chennai), Problem Statement 1: protecting senior citizens and first-time digital users from social-engineering fraud. Every bank, NPCI, police and FIU rail in this prototype is simulated and labelled on screen. No real money, PINs or reports move.

## Who builds what

Three workstreams, one repo. Read [docs/SCHEMA.md](docs/SCHEMA.md) first: it is the contract that
keeps the three from colliding, and it fixes the one money formula all of us share.

| Module | Pillar | Owner | Branch | Brief | Owns |
|---|---|---|---|---|---|
| SHIELD | Prevention | Member 1 | `shield` | [PRD-1](docs/PRD-1-SHIELD.md) | `/shield` — writes `calls`, `detections` |
| TRACK | Protection | Member 2 | `track` | [PRD-2](docs/PRD-2-TRACK.md) | `/pay`, `/dashboard` — writes `incidents`, `accounts` |
| AGENT | Precaution | Member 3 | `agent` | [PRD-3](docs/PRD-3-AGENT.md) | `/agent` — writes `agentTasks` |

Never write to a collection you do not own. Read anything.

```bash
git fetch origin
git checkout shield          # or track / agent
git config user.name "Your Name"
git config user.email "your@email"
```

How the three join up: SHIELD writes a `calls` document, TRACK reads its `callId` to open an
incident, AGENT reads `accounts` to know what the victim can still spend. Everything moves between
screens over Firestore `onSnapshot`, so no module has to call another.

## Run it

```bash
npm install
npm run dev
```

Then open **http://localhost:3000**. Node 18+ (built on Node 22). No database, no keys, no internet needed.

| Screen | Who | Open it on |
|---|---|---|
| `/presenter` | you | the laptop |
| `/stage` | the projector | a second window, full screen |
| `/phone` | Lakshmi, 68 | a phone on the same wifi (`http://<laptop-ip>:3000/phone`) or a narrow window |
| `/guardian` | Priya, her daughter | another phone or window |

Demo PINs: **4471** real, **9999** duress (safety) PIN.

### Let the team in from anywhere

```bash
npm run tunnel
```

Prints a public HTTPS link and keeps it alive. HTTPS also unlocks the phone microphone, which a
plain local address blocks. On the same wifi the local address is faster. See
`.claude/project/DEPLOYMENT.md` for the DNS caveat on campus networks.

## The demo in five beats (about three minutes)

1. **Ordinary payment.** Presenter → Beat 1. Phone: tap Kumar Stores, type 340, PIN 4471. Nothing fires. *(Say: we don't harass real users.)*
2. **The scam call.** Beat 2. Stage plays the call, one line every 2.6 s; the five markers light up. Point at the attestation line: *"No police unit has attested a call to you."* Phone can tap **Add Priya to this call**; the caller hangs up.
3. **The coached payment.** Beat 3. Phone: type 50000 slowly, with pauses and a backspace. Continue → held → interview. Hand the phone (or the stage microphone) to a judge to speak the scam story. The scam is named. Guardian taps **Stop it**. Alternative: enter PIN 9999 for the duress path.
4. **The money already left.** Beat 4. Stage: golden-hour clock, tree reveals a hop every 3 s, holds land. ₹20 held in the tea stall, ₹1,99,990 free, Ravi's ₹10 untouched. Presenter or stage: **Confirm incident**.
5. **Immunity.** Beat 5. Phone: type any amount, Continue → *"Payment not started. This account was reported N seconds ago by another TRACE user."* Stage: network tab, campaign banner, evidence pack.

6. **Card fraud.** Beat 6. Stage: the Card tab streams held-out PaySim transactions through the XGBoost model, showing probability, decision and TP/FP/FN/TN. Phone: a held card payment asks "Was this you?". *(Say: trained in Python once on the source repository's pipeline; scored here in TypeScript, parity-tested; synthetic data, so an upper bound.)*

Extras from the presenter panel: **Audio check** (synthetic-media indicator, simulated), **Agent: book a trip** (pays within ₹2,000, asks Priya above it), the **QuickCash Loan EMI** payee on the phone (unregistered lender is stopped), and **Run a rehearsal call**.

If anything goes wrong: Presenter → **Reset everything**, then the beat you were on. Hotspot and firewall steps are in `.claude/project/DEPLOYMENT.md`.

## What runs for real (unit-tested)

`npm test` runs the suite over the six engines in `src/lib`:

- `screening.ts` – five-marker script detector, risk model, fingerprint
- `coercion.ts` + `hesitation.ts` – Coercion Score; hesitation is measured in the browser and only the index is sent
- `taxonomy.ts` – deterministic scam-narrative classifier, 12 scam families, works offline
- `taint.ts` – Proportional Freeze: haircut taint, hop cap, de-minimis floor
- `attestation.ts` – Caller Attestation registry
- `immunity.ts` – immune registry, caller reputation, campaign detection
- `store.ts` – the single in-memory state and every action, including the six beats end to end
- `cardModel.ts` – walks the XGBoost trees in `src/data/card-model.json`; `cardModel.test.ts` proves TypeScript matches Python within 1e-4

`npm run typecheck` runs TypeScript strict.

### Retrain the card model

```bash
pip install -r ml/requirements.txt
npm run train:card
```

Downloads PaySim (about 490 MB) from a public Hugging Face mirror once, trains `XGBClassifier` on a balanced split (the source repository's approach), prints held-out metrics, and rewrites `src/data/card-model.json`.

## What is simulated

Bank ledger and UPI rails, the attestation registry, freeze execution (TRACE triggers; only a bank can place a lien), NCRP / CFCFRMS / FIU-IND filings (drafts, human-confirmed), and the synthetic-media detector. Each carries a SIMULATED tag on screen.

## Architecture

One Next.js app. Four browser screens poll `GET /api/state` every 400 ms and send `POST /api/action` with an `x-trace-role` header. The reducer in `src/lib/store.ts` is the only writer. State lives in memory; a restart plus Reset recovers the demo. Optional `OPENROUTER_API_KEY` (see `.env.example`) only rewrites rebuttal wording after the deterministic text is on screen; nothing on stage depends on it.

Design documents live in `.claude/project/` (problem, requirements, features, flows, UI spec, architecture, tech stack, data model, API).

## Firebase?

Not needed for the demo. If phones must reach the app over the internet rather than the laptop's wifi, the in-memory store moves to Firestore (one file, `src/lib/store.ts`) and the app deploys to Firebase App Hosting or Vercel.
