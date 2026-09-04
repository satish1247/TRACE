# Security

<!-- pf:unwritten -->
> Delete the line above once this document holds real content. Gates and the
> final audit read that marker as "nobody has written this yet", so leaving it
> in place on a finished document blocks completion, and deleting it on an
> empty document is how a project starts lying to itself.

**Project:** TRACE SHIELD
**Owner:** security-audit-agent
**Written during:** phase 13
**Last updated:** 2026-09-03T20:25:50Z

Threats, controls, and the evidence that each control exists. Written for
this project specifically - a generic checklist proves nothing.

## Assets and threats

What is worth attacking here (accounts, personal data,
payments, device control) and who would attack it.

## Authentication and sessions

How identity is proven, how sessions expire, how
credentials are stored, and how account recovery works without becoming a
bypass.

## Authorisation

The rule for every protected action, and where it is enforced.
Enforcement in the interface only is not enforcement.

## Input handling

Validation at each boundary, injection defences, file upload
limits, and output encoding.

## Secrets and configuration

Where secrets live, how they reach the running
system, and confirmation that none are in the repository.

## Transport and storage

What is encrypted in transit and at rest.

## Findings and fixes

| ID | Severity | Finding | Status | Evidence |
|---|---|---|---|---|

## Residual risk

What remains, and why it is acceptable for this project.
