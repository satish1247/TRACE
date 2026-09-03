# Security

Scope: a hackathon prototype on simulated rails. There are no accounts, no real money and no persistence. The controls below are real in the code; the threat model is the demo laptop plus phones on its hotspot.

## Threats considered

| Threat | Control |
|---|---|
| A phone screen driving presenter-only or guardian-only actions | Role header checked in `src/app/api/action/route.ts`; per-action allow-list in `src/lib/store.ts` (`PERMISSIONS`) |
| Malformed or oversized bodies | zod schemas on every POST; amounts bounded; strings length-capped |
| Illegal state transitions (PIN before review, veto of a closed request) | Reducer throws `ActionError` 409 and leaves state untouched |
| Leaking raw behavioural data | Hesitation timings and microphone audio never leave the browser; only a 0..1 index and the spoken text are posted |
| Secret exposure | Only `OPENROUTER_API_KEY` via env; `.env` ignored; never logged |
| Stack traces to clients | Unexpected errors log server-side, clients get "internal error" |
| XSS | React escaping only; no `dangerouslySetInnerHTML`, no eval |

## The nine areas

| Area | Status | Evidence |
|---|---|---|
| authentication | N/A | No user accounts in the prototype; the two demo PINs are documented constants (README) checked in the reducer. Production would sit inside the bank app's existing authentication. |
| authorization | PASSED | Every mutating request carries x-trace-role; src/app/api/action/route.ts rejects unknown roles with 403 and src/lib/store.ts PERMISSIONS refuses actions outside the role (cosign.decide guardian-only, demo.* presenter-only). Verified by hand with curl and by the role table. |
| input_validation | PASSED | zod schemas on every POST body (action, classify, screen); amount bounded to (0, balance] and payload fields coerced by str()/num() in the reducer; illegal state transitions throw ActionError 409 without mutating state (store.test.ts 'illegal transitions'). |
| secrets | PASSED | Only OPENROUTER_API_KEY/OPENROUTER_MODEL, read from process.env in src/lib/llm.ts; .env is git-ignored; .env.example carries no values; the key is never logged or returned to clients. |
| database_access | N/A | In-memory state only; no database, no query construction. |
| api_security | PASSED | Distinct 400/403/409 responses with plain messages; unexpected errors log server-side and return 'internal error' (no stack traces); GET /api/state is no-store; same-origin fetches only; no CORS opened. |
| sensitive_data | PASSED | Keystroke timings are reduced to one index in the browser (src/lib/hesitation.ts) and only the index is posted; microphone audio is transcribed in the browser and only text is posted; no real PINs, names or accounts (fictional seed). |
| file_uploads | N/A | The product accepts no uploads. |
| common_web_vulnerabilities | PASSED | No dangerouslySetInnerHTML, eval or dynamic script; React escapes all rendered text; no cookies or sessions to CSRF; the role header is documented as demo-only, not a production boundary. |

## Known limitations (say them before a judge does)

- The role header is a demo convenience, not authentication. In production TRACE sits inside the bank's authenticated app and the co-sign path uses the guardian's own authenticated session.
- State is in memory; a server restart clears it by design.
- The attestation registry, lender registry and immunity registry are illustrative data.
