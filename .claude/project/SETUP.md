# Setup

From a clean machine to a running demo.

## Prerequisites

| Need | Version used | Check |
|---|---|---|
| Node.js | 22.20.0 | `node -v` |
| npm | 10.9.3 | `npm -v` |
| Chrome | any recent | needed only for the microphone moments |
| Python (optional) | 3.12 | only to retrain the card model |

Nothing else. No database, no Docker, no cloud account, no API key.

## Run the app

```bash
npm install
npm run build
npm start
```

Open http://localhost:3000. It lists the four screens. Start at **Presenter**, press **Reset everything**, then **Beat 1**.

`npm run dev` also works and hot-reloads, but `npm start` is steadier for a live demo.

## Demo constants

| Thing | Value |
|---|---|
| Real UPI PIN | `4471` |
| Duress (safety) PIN | `9999` |
| Lakshmi's opening balance | ₹84,320 |
| Agent spending limit | ₹2,000 |

## Optional: warmer rebuttal wording

```bash
cp .env.example .env
# then set OPENROUTER_API_KEY=... in .env
```

The deterministic rebuttal always appears first; if the key is present and the network responds within 3 seconds, the wording is replaced with a warmer version. With no key, no network, or any error, nothing changes. Restart the server after editing `.env`.

## Optional: retrain the card-fraud model

```bash
pip install -r ml/requirements.txt
npm run train:card
```

Downloads PaySim (about 490 MB) once to `ml/data/paysim.csv` from a public Hugging Face mirror, trains `XGBClassifier` on a balanced split, prints held-out metrics, and rewrites `src/data/card-model.json`. Takes about two minutes on a laptop. If the download is blocked, fetch the Kaggle file `PS_20174392719_1491204439457_log.csv` by hand and save it to that path; the script then skips the download.

`npm test` fails if the exported model and the TypeScript scorer ever disagree, so run it after retraining.

## Verify the install

```bash
npm test          # 12 files, 63 tests
npm run typecheck # TypeScript strict, no output means clean
```

## Phones

See `DEPLOYMENT.md` for the hotspot, laptop IP and Windows firewall steps.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Reconnecting to TRACE" banner | The server stopped. Restart it, then Presenter → Reset → your beat. |
| Port 3000 busy | `npx kill-port 3000`, or change the port in `package.json`. |
| Microphone button missing | Not Chrome, or the page is not on `localhost`/HTTPS. Use the typed answer; the demo does not depend on speech. |
| Card tab empty | Press **Stream card transactions** on the presenter, or Beat 6. |
| A screen looks stale after a code edit | The in-memory state re-seeds itself on a shape change; if in doubt press Reset. |
