# Project overview

**Project:** TRACE SHIELD
**Owner:** orchestrator
**Written during:** phase 0
**Last updated:** 2026-09-04

The one page a newcomer reads first.

## What this is

SHIELD is the "is this call a scam?" module of TRACE, a hackathon prototype that
protects people (especially senior citizens and first-time digital users) from
social-engineering fraud calls. While a call is happening, SHIELD transcribes it
live, reads the script for five known scam markers, raises a 0-100 risk score in
real time, names the exact scam family, and interviews the person instead of
just showing a warning banner. It optionally checks uploaded audio/image for a
cloned voice or face. It writes what it finds to Firestore so the other two
TRACE modules (TRACK, which traces and freezes stolen money, and AGENT, an
approval-gated payment assistant) can react to it live.

## Project classes

`software` (transcript UI, risk dial, verdict card), `service` (Firestore reads
and writes shared with two other modules), `ml` (pretrained deepfake
voice/face detection, served locally — no training).

## Who it is for

Primary: the person on the call (potential scam victim), watching `/shield` on
a laptop or phone. Secondary: the other two team members' modules (TRACK,
AGENT), which read `calls` written by SHIELD. Tertiary: a hackathon judge,
who will look for what is real vs simulated.

## What success looks like

- Speaking a digital-arrest script out loud drives the risk meter past 45,
  lights the five markers in the order they occur, and names the scam.
- The interview step asks a real question, classifies a spoken/typed answer,
  and names the scam back in one sentence.
- A `calls` document written by SHIELD appears on a teammate's screen (via
  `onSnapshot`) within one second, with no page refresh.
- Uploading a sample voice or face clip returns a real/fake verdict with the
  numbers that produced it, whether from the pretrained model service or the
  offline acoustic fallback.

## What is explicitly out of scope

- Training any model (pretrained weights only).
- Writing to any Firestore collection other than `calls` and `detections`.
- The `/pay`, `/dashboard`, `/agent` routes and the shared portal (`/`) — owned
  by teammates.
- Real telephony integration — the call is transcribed from mic/typed input in
  the browser, not intercepted from an actual phone line.

## Current status

See `.claude/state/CURRENT-PHASE.md` and `pf_state.py report`.
