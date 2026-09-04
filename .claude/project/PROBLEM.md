# Problem definition

**Project:** TRACE SHIELD
**Owner:** problem-discovery-agent
**Written during:** phase 1
**Last updated:** 2026-09-04

## The problem

Social-engineering phone scams (fake police/CBI "digital arrest", courier/parcel
threats, fake bank fraud alerts, electricity-disconnection threats) convince
victims — disproportionately senior citizens and first-time digital users — to
move money or hand over OTPs/credentials while still on the call. Roughly 90%
of these scams use a real human voice, not a cloned one, so a deepfake detector
alone catches almost nothing; the thing that actually predicts a scam is the
structure of what the caller says (claim authority, manufacture a threat,
isolate the victim, demand payment or credentials, block verification). Victims
are told in advance that any warning they see is "a system error" — so a plain
warning banner is pre-inoculated against.

## How it is solved today

Nothing runs during the call itself. Some banks send an SMS after a suspicious
transaction; some carriers label likely spam numbers. Neither reads what is
actually being said in real time, and neither survives the "ignore the warning,
it's fake" instruction the scammer gives up front.

## Why now

Built for a hackathon (Innovation Unbound Round 2, VIT Chennai) under a hard
deadline, as one of three modules (SHIELD / TRACK / AGENT) built by three
people in one shared repo. SHIELD is the entry point: it is the module that
decides a call is a scam at all, which is what TRACK and AGENT react to.

## Evidence

Sourced from the PRD (`PRD-1-SHIELD.md`, provided by the user/team): the five
markers and their weights, the requirement that Marker 3 (isolation
instruction — "stay on the call, don't tell your family") is the single
strongest and least ambiguous signal ("no bank, police officer or company has
ever legitimately told a customer to stay on the line and not tell their
family"), and the choice of pretrained deepfake models over training one,
since the team has no labelled dataset and no time to build one.

## Constraints discovered

- Hard hackathon deadline; team of three, one shared repo, strict
  collection-ownership rule (SHIELD writes only `calls`/`detections`).
- Web Speech API requires Chrome and a secure origin (`localhost` works,
  `http://192.168.x.x` does not) — a typed fallback is mandatory, not optional.
- Venue wifi may fail — model weights must be downloaded and cached in advance;
  the offline acoustic-forensics fallback must work with zero network.
- One microphone: a recorder and a speech recogniser must never run at once.
