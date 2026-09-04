# Security checks

Each area must be checked and evidenced before GATE-4. An area
marked N/A still needs a reason recorded as its evidence.

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
