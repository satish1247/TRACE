# Technology choices

| Choice | Reason | Rejected alternative |
|---|---|---|
| Next.js 15, App Router, TypeScript | One process serves four screens and the API; route handlers are enough; TypeScript catches contract drift between screens | Vite + Express: two processes to keep alive at 2 a.m. |
| In-memory store, persisted to Firestore or a disk snapshot | The demo survives a crash or restart mid-presentation; Firestore also makes it multi-device over the internet; writes are debounced and fire-and-forget so they can never block a payment | SQLite/Postgres: a service to install and keep alive at 2 a.m. |
| Server-Sent Events, with polling as fallback | Genuine server push: the guardian's screen changes in milliseconds. One-way, so far simpler than WebSockets, and it degrades to polling instead of dying | Polling only: works, but does not behave like a live system. WebSockets: bidirectional complexity we do not need |
| zod for action validation | Boundaries validated once, in one place | Hand-written checks |
| Tailwind CSS | Speed; consistent spacing across four screens | Custom CSS: slower for four screens in 24 h |
| Vitest | Fast unit tests for the pure libraries; runs in CI-less environments | Jest: slower setup |
| Web Speech API (Chrome) with typed fallback | Zero dependencies for the mic; the fallback keeps the demo independent of the browser and the network | Cloud STT: needs wifi and a key |
| Optional OpenRouter API for rebuttal wording | Improves phrasing when available; 3 s timeout; never on the critical path | Making the LLM primary: dies with the wifi |
| Python + XGBoost + imbalanced-learn for training only | Mirrors the source repository's pipeline; runs once, offline | Python microservice at demo time: a second runtime to keep alive |
| Tree export to JSON, scored in TypeScript | One runtime on stage, deterministic, parity-tested | ONNX runtime in Node: heavier dependency for 120 small trees |
| Node 22 (present on the build machine) | Verified: `node -v` = v22.20.0 | - |

No database service, no message queue, no container. Start: `npm run dev`. Test: `npm test`.
