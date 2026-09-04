# The contract — read this before writing any code

Three people build three modules in one repo. This file is the only thing stopping you from
colliding. **Nobody changes a shape in here without telling the other two.**

Project: `trace-180` · Repo: `github.com/satish1247/TRACE`

## Who owns what

| Module | Owner | Routes | Firestore it WRITES | Firestore it READS |
|---|---|---|---|---|
| SHIELD | Member 1 | `/shield/*` | `calls`, `detections` | `users` |
| TRACK | Member 2 | `/pay/*`, `/dashboard` | `incidents`, `incidents/*/hops`, `accounts` | `users`, `calls` |
| AGENT | Member 3 | `/agent/*` | `agentTasks` | `users`, `accounts` |
| Portal | shared, merge last | `/` | nothing | all |

**Rule: never write to a collection you do not own.** If you need something changed there, ask its
owner for a function. This is what makes three people in one repo possible.

## Collections

```ts
// users/{uid}            seeded once, everyone reads
{ name: string; vpa: string; balance: number; guardianUid: string | null;
  agentLimit: number; thresholdShift: number }

// calls/{callId}         SHIELD writes
{ startedAt: number; callerId: string; callerName: string;
  transcript: { speaker: 'caller' | 'user'; text: string; at: number }[];
  markers: ('authority'|'threat'|'isolation'|'demand'|'blocking')[];
  risk: number;                    // 0..100
  scamType: string | null;         // e.g. 'digital_arrest'
  active: boolean }

// detections/{id}        SHIELD writes
{ at: number; kind: 'voice' | 'face' | 'transcript';
  verdict: 'real' | 'fake' | 'uncertain';
  confidence: number;              // 0..1
  model: string;
  evidence: Record<string, string | number>;
  callId: string | null }

// incidents/{incidentId} TRACK writes
{ createdAt: number; victimUid: string; amount: number;
  scammerVpa: string; scamType: string | null; callId: string | null;
  status: 'reported' | 'tracing' | 'frozen' | 'recovered';
  recovered: number; goldenHourEndsAt: number }

// incidents/{incidentId}/hops/{hopId}   TRACK writes
{ hop: number; parentHopId: string | null;
  fromVpa: string; toVpa: string; label: string;
  kind: 'scammer' | 'mule' | 'merchant' | 'individual' | 'cashout';
  amount: number; balanceBefore: number; forwarded: number;
  taint: number; held: number; at: number }

// accounts/{vpaKey}      TRACK writes   (vpaKey = vpa with '.' and '@' replaced by '_')
{ vpa: string; flagged: boolean; reportedAt: number; incidentId: string }

// agentTasks/{taskId}    AGENT writes
{ createdAt: number; uid: string; request: string;
  steps: { at: number; text: string }[];
  price: number; limit: number;
  status: 'searching' | 'filling' | 'awaiting_approval' | 'paid' | 'declined';
  approverUid: string | null }
```

All timestamps are epoch milliseconds (`Date.now()`).

## Money rules, identical in all three modules

Copy `src/lib/taint.ts`. Do not fork the maths.

```
taint(child) = child.amount × (taint(parent) / (parent.balanceBefore + parent.amount))
held         = taint >= FLOOR ? min(taint, currentBalance) : 0
FLOOR        = 15                                    // rupees
currentBalance = balanceBefore + amount - forwarded
```

**The test every module must pass:** ₹50,000 stolen, split ten ways. A shop receives ₹20 into a
₹2,00,000 balance and holds ₹20, keeping ₹1,99,990. Its customer receives ₹10 and holds ₹0.

## Realtime

Use Firestore `onSnapshot`. Never poll. Every screen subscribes to what it renders and updates the
instant another module writes.

## Git

```bash
git checkout -b shield          # or track / agent
git config user.name "Your Name"
git config user.email "your@email"
git push -u origin shield
```

Merge to `main` through pull requests. Only the portal page is shared, so touch it last and
together. Local tool and editor config stays out of the repo; `.gitignore` already excludes
`.claude/` and `.env`. If the event asks whether you used AI assistance, answer honestly; most
hackathons allow it and only ask that you say so.

## Definition of done, per module

1. It works with the wifi off, except where a model server is genuinely required.
2. Every claim on screen is either measured or labelled SIMULATED.
3. One unit test per rule a judge might question.
4. It writes only its own collections.
