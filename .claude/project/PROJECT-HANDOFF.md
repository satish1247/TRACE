# Project handoff

<!-- pf:unwritten -->
> Delete the line above once this document holds real content. Gates and the
> final audit read that marker as "nobody has written this yet", so leaving it
> in place on a finished document blocks completion, and deleting it on an
> empty document is how a project starts lying to itself.

**Project:** TRACE SHIELD
**Owner:** documentation-agent
**Written during:** phase 16
**Last updated:** 2026-09-03T20:25:50Z

Written for a person or model who has never seen this conversation. If a
reader needs the chat history to understand any section, that section is not
finished. This is the single most valuable document in the project.

## What this project is

In plain language, with the problem it solves.

## Who uses it and how

Roles, and the main journey for each.

## How it is built

Architecture summary, then where to find the detail.

## Technology

Stack and versions, and why each was chosen.

## Data

Entities, storage, and the rules that must stay true.

## Interfaces

APIs, protocols, and integrations, with the contract location.

## Business rules

The non-obvious logic: pricing, eligibility, thresholds,
calibration constants. These are the things a reader cannot infer from code.

## Running it

Setup from a clean machine, environment variables, how to run
tests, how to deploy.

## Current status

Which features are COMPLETE, which are partial, and the exact
phase the project stopped at.

## Known issues and limitations

Honest list. Include anything that works only
under conditions a new reader would not guess.

## Remaining work

Prioritised, with the reason each item matters.

## Where the state lives

`.claude/project/` for narrative, `.claude/state/` for
status, `state.json` as the machine-readable source of truth. Run
`pf_state.py report` for a current summary.
