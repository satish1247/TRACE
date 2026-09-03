# TRACE

**One line:** an app that protects elderly and first-time digital banking users from scam calls and coerced payments, traces stolen money inside the golden hour, freezes only the tainted amount, and immunises the whole network against the next attempt.

**Context:** Innovation Unbound Round 2, a 24-hour offline hackathon at VIT Chennai (3-4 Sept 2026). Problem Statement 1: protect vulnerable customers (senior citizens, first-time digital banking users, digitally inexperienced people) from scams, social engineering and fraudulent transactions.

## What it is, in plain words

Banks check whether a payment is correct. TRACE checks whether the person making it is free. When a scammer is on the phone telling a 68-year-old which button to press, every PIN is entered correctly, so the bank sees a perfect payment. TRACE looks for the criminal standing behind her instead: the live call, the screen-sharing app, the hesitant typing, the words "don't tell anyone". Then it does something the scammer could not have scripted: it asks her, in her own language, to say out loud who the money is for, and names the exact scam back to her.

If money has already gone, TRACE races the clock: it traces where it went, holds only the stolen amount (never an innocent shopkeeper's whole account), and hands the bank an evidence pack in minutes. Every incident then immunises everyone else on the network.

## Three pillars

| Pillar | When | What |
|---|---|---|
| Protection | before money moves | call screening on the script, coercion scoring, the interview, graduated response, trusted circle, caller attestation, duress PIN, un-isolate |
| Retrieval | after money moves | money-flow tree, golden-hour clock, Proportional Freeze, evidence pack |
| Precaution | so it never repeats | network immunity, caller reputation, campaign detection, scam rehearsal, verified-link shield |

## Five inventions (mechanisms that did not exist)

1. **Caller Attestation** - nobody is the police unless the police told TRACE first. Unattested authority claims are fraud by definition.
2. **Duress PIN** - a silent alarm inside the payment: a second PIN that shows a true "under verification" receipt, holds the funds and calls for help.
3. **Un-isolate** - one tap conferences the guardian into the live scam call; scammers hang up when a third party joins.
4. **Scam Rehearsal** - consented fire drills that tune each person's own thresholds.
5. **Campaign detection** - epidemiology for scam scripts: an outbreak raises everyone's guard.

## What this build is

A working prototype on simulated bank, NPCI, police and FIU rails, built backwards from a five-beat, three-minute stage demo. No real money, PINs or reports move. Every simulated rail is labelled as simulated on screen.

**People:** Lakshmi (68, Chennai, pays the kirana store and receives a pension by UPI); Priya, her daughter (the trusted circle); the presenter; the judges.
