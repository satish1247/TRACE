# Deployment and operations

<!-- pf:unwritten -->
> Delete the line above once this document holds real content. Gates and the
> final audit read that marker as "nobody has written this yet", so leaving it
> in place on a finished document blocks completion, and deleting it on an
> empty document is how a project starts lying to itself.

**Project:** TRACE SHIELD
**Owner:** devops-agent
**Written during:** phase 15
**Last updated:** 2026-09-03T20:25:50Z

How this runs somewhere other than one laptop, and how it is recovered
when it breaks.

## Environments

Local, staging, production: what differs and who can reach each.

## Build and release

The steps from source to running system, automated where
possible, with the command for each.

## Configuration

Every environment variable and setting: name, purpose, example
value, and whether it is a secret.

## Provisioning

Infrastructure, services, domains, certificates, devices to flash.

## Monitoring

What is watched, where the logs go, and what alerting exists.

## Rollback

How to get back to the previous working state, and how long it takes.

## Runbook

The three failures most likely to happen, and the response to each.
