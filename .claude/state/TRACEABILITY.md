# Traceability matrix

requirement -> feature -> task -> code -> test -> documentation.
Rows with **NONE** are unimplemented or unverified requirements and are
audit failures, not notes.

| Req | Text | Pri | Features | Tasks | Files | Passing tests | Docs |
|---|---|---|---|---|---|---|---|
| REQ-001 | Demo user (Lakshmi, 68) can pay a known payee by UPI in the  | must | FEAT-001 | 1 | 3 | TEST-011 | - |
| REQ-002 | Call screening reads a live or scripted call transcript and  | must | FEAT-002 | 2 | 3 | TEST-013 | - |
| REQ-003 | Coercion Score at payment combines: active call, remote-acce | must | FEAT-003 | 1 | 4 | TEST-001, TEST-007 | - |
| REQ-004 | Graduated response from the score: allow, soft check, hold w | must | FEAT-003 | 1 | 4 | TEST-001, TEST-007 | - |
| REQ-005 | Voice interview: when held, the app asks the user in plain w | must | FEAT-004 | 1 | 2 | TEST-014 | - |
| REQ-006 | Trusted Circle: a held payment pushes full context to a guar | must | FEAT-005 | 1 | 1 | TEST-004 | - |
| REQ-007 | Retrieval: from a stolen amount, simulate and visualise the  | must | FEAT-006 | 2 | 3 | TEST-012 | - |
| REQ-008 | Proportional Freeze: pro-rata (haircut) taint, per-hop dilut | must | FEAT-006 | 2 | 3 | TEST-012 | - |
| REQ-009 | Network immunity: a confirmed incident publishes the mule VP | must | FEAT-007 | 1 | 2 | TEST-010 | - |
| REQ-010 | Every classifier works deterministically offline; an LLM key | must | FEAT-004, FEAT-020 | 2 | 4 | TEST-014, TEST-020 | - |
| REQ-011 | Single runtime, starts with one command, in-memory state, on | must | FEAT-001, FEAT-008 | 6 | 14 | TEST-006, TEST-011 | - |
| REQ-012 | Presenter panel triggers the five demo beats deterministical | must | FEAT-008 | 5 | 11 | TEST-006 | - |
| REQ-013 | Verified-link shield: typing a customer-care search intent i | should | FEAT-014 | 1 | 3 | TEST-015 | - |
| REQ-014 | Evidence pack: a confirmed incident generates a simulated NC | should | FEAT-007 | 1 | 2 | TEST-010 | - |
| REQ-015 | Caller reputation: a number that ran the script on one user  | should | FEAT-002 | 2 | 3 | TEST-013 | - |
| REQ-016 | Privacy: all coercion signals compute in the browser; only t | should | FEAT-003 | 1 | 4 | TEST-001, TEST-007 | - |
| REQ-017 | Works at phone width and on a projector; large-text mode; ke | should | FEAT-015 | 2 | 2 | TEST-021 | - |
| REQ-018 | Synthetic-media (voice/face clone) indicator shown on curate | could | FEAT-017 | 1 | 3 | TEST-017 | - |
| REQ-019 | Loan-app checkpoint: before a lending app payment, check len | could | FEAT-018 | 1 | 3 | TEST-018 | - |
| REQ-020 | Guided booking agent that pays within a user-set limit (demo | could | FEAT-019 | 1 | 3 | TEST-019 | - |
| REQ-021 | Card-fraud ML engine and crypto off-ramp tracing | could | FEAT-016 | 1 | 6 | TEST-016 | - |
| REQ-022 | Caller Attestation: institutions attest a call through the c | must | FEAT-009 | 2 | 5 | TEST-009 | - |
| REQ-023 | Duress PIN: the user registers a second PIN; entering it und | must | FEAT-010 | 1 | 3 | TEST-008 | - |
| REQ-024 | Scam Rehearsal: a consented drill runs a simulated scam call | should | FEAT-012 | 1 | 2 | TEST-005 | - |
| REQ-025 | Un-isolate: during a flagged live call, one tap conferences  | should | FEAT-011 | 1 | 2 | TEST-002 | - |
| REQ-026 | Campaign detection: the same script fingerprint across many  | should | FEAT-013 | 1 | 2 | TEST-003 | - |
| REQ-027 | Real-time transport: the server pushes state changes to ever | must | FEAT-021 | 1 | 4 | TEST-022 | - |
| REQ-028 | Durability: live state survives a server restart, via Firest | must | FEAT-022 | 1 | 4 | TEST-023 | - |
