# The problem

Stated without a solution.

India's cyber-fraud losses were projected by I4C at Rs 1.2 lakh crore for 2025, about 0.7% of GDP. Digital-arrest scams alone produced 2,97,727 complaints and Rs 4,057.7 crore in losses between 2022 and May 2026. Senior citizens filed over 1.2 lakh complaints on the national portal in 2025, up 40% on 2023.

## The mechanism

In the dominant attacks (digital arrest, KYC update, fake customer care, courier parcel, electricity disconnection) nothing is hacked. A person calls, claims authority, manufactures a threat, isolates the victim ("stay on the call, don't tell anyone") and coaches them through their own banking app. The victim enters the correct PIN on the correct device. Every authentication factor passes. The transaction looks flawless to the bank's fraud engine because the anomaly is not in the transaction; it is in the human.

## Why existing defences fail

1. Fraud engines score the transaction, not the state of the person making it.
2. Warnings are pre-inoculated: the script tells the victim to ignore the app's warning before it appears.
3. The victim cannot verify the caller; the burden of verification sits on the least equipped party.
4. Isolation is the scammer's core weapon and no product attacks it directly.
5. Once money moves, recovery is slow (days) and enforcement is blunt: downstream full-account freezes reached 36,000+ accounts from one investigation and froze Rs 1 lakh+ belonging to an innocent nursery owner over a Rs 150 receipt. The Supreme Court has directed RBI to write an SOP for this.
6. Each bank sees only its own fraction of a scam that is deliberately layered across many banks.

## Who is harmed

Senior citizens, first-time digital users and low-digital-literacy users; and, as second victims, innocent merchants and individuals downstream of a mule account.

## Constraints

24 hours; one to five student builders; a demo laptop and a projector; no access to real bank, NPCI, police or FIU systems; unreliable venue wifi; judges with banking and ML backgrounds who will probe false positives, privacy, legal authority and overclaiming.

## What success looks like for the demo

A genuine payment goes through untouched; a scripted scam is caught by its words, not its audio; the victim is interviewed and the scam is named; a guardian can veto; stolen money is traced and only the tainted amount is held; the network becomes immune. About three minutes, with every simulated rail labelled.
