# Data architecture

**Project:** TRACE SHIELD
**Owner:** database-agent
**Written during:** phase 7
**Last updated:** 2026-09-04

Firestore, shared with TRACK and AGENT. Shapes below are **fixed by
`SCHEMA.md`** (the team contract) — SHIELD does not change them unilaterally.

## Entities (SHIELD-owned collections)

```ts
// calls/{callId}
{ startedAt: number;               // epoch ms
  callerId: string; callerName: string;
  transcript: { speaker: 'caller' | 'user'; text: string; at: number }[];
  markers: ('authority'|'threat'|'isolation'|'demand'|'blocking')[];
  risk: number;                    // 0..100, monotonically non-decreasing
  scamType: string | null;         // e.g. 'digital_arrest'; null until named
  active: boolean }

// detections/{id}
{ at: number;
  kind: 'voice' | 'face' | 'transcript';
  verdict: 'real' | 'fake' | 'uncertain';
  confidence: number;              // 0..1
  model: string;                   // e.g. 'MelodyMachine/Deepfake-audio-detection-V2' or 'acoustic-fallback'
  evidence: Record<string, string | number>;
  callId: string | null }
```

## Entities (read-only)

```ts
// users/{uid}   seeded once by the team, SHIELD only reads
{ name: string; vpa: string; balance: number; guardianUid: string | null;
  agentLimit: number; thresholdShift: number }
```

## Relationships

`detections.callId` optionally references `calls/{callId}` (nullable — a
standalone media upload on `/shield/media` has no active call). No cascade
deletes are implemented; this is a hackathon demo with no delete flow.

## Invariants

- `risk` never decreases within one `calls` document's lifetime — enforced in
  application code (`markers.ts` always folds new markers into the running
  max), not by a Firestore rule (Firestore can't express monotonicity cheaply).
- `markers` contains no duplicates — same enforcement point.
- SHIELD never writes fields outside the shapes above, and never writes to
  `incidents`, `accounts`, or `agentTasks` — enforced by (a) `firestore.ts`
  being the only file that imports `firebase/firestore`, and (b) Firestore
  security rules restricting the `calls`/`detections` collections to writes
  matching this shape (`zod` schema validated client-side before every write,
  mirrored in rules where Firestore's rule language allows).

## Indexes and access patterns

- `calls`: read/write by document id (the active call) — no query, no index
  needed. TRACK's dashboard queries `calls` by `active == true` — that index
  is TRACK's to declare (SHIELD doesn't need it).
- `detections`: written by id, optionally queried by `callId` — a
  single-field index, auto-created by Firestore.

## Migrations

No formal migration tooling for a hackathon demo. A shape change to
`calls`/`detections` requires editing `SCHEMA.md` and notifying TRACK/AGENT's
owners first (per the contract), then updating `src/lib/shield/firestore.ts`
and the `zod` schema together in one commit.

## Retention and privacy

Transcript text and caller names are the only personal-ish data, and this is
a simulated demo — no real callers, no real PII. Everything lives in the
`trace-180` Firestore project only, is not exported, and a "Reset everything"
action any teammate can trigger clears the demo data (implemented once,
shared, not duplicated by SHIELD).
