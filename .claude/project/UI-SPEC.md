# UI specification

Four screens, one design system. Phone screens are 390 px wide in a device frame on desktop and full-bleed on a real phone. Stage is 16:9. Type: system sans, minimum 17 px on phone, 22 px on stage; large-text toggle scales 1.25x. Colours: ink, ground, one signal colour (amber) for holds and the clock, teal for safe, brick for critical. Every simulated rail carries a small "SIMULATED" tag.

## /phone (Lakshmi)

Header: bank name "Fed Bank (demo)", balance, tiny SIMULATED tag. Global states: reconnecting banner; large-text toggle.

- **Home**: balance card; payee tiles (Kumar Stores, Pension, Priya); Pay button; search box (verified-link shield). Empty state: none needed (seeded). Loading: skeleton for 400 ms max.
- **Incoming call sheet** (over any screen): caller line, attestation line (green "Attested by Fed Bank - code 7Q2M" or red "No police unit has attested a call to you. This caller is not who they say they are."), Answer / Decline, and after the conference threshold the "Add Priya to this call" button. Conference state: "Priya joined" chip, then "[caller disconnected]".
- **Pay**: payee (known chip or "New payee - pasted" chip), amount input (hesitation is measured here, nothing is stored), Continue. Validation: amount > 0 and <= balance.
- **Review**: payee, amount, tiny coercion pill (Low / Check / Hold / Stop). Continue to PIN.
- **PIN**: 4-digit pad. 4471 = real, 9999 = duress. Error: "PIN did not match".
- **Soft check** (tier CHECK): "Is this someone you have paid before?" Yes / No, then continue.
- **Held / Interview** (tier HOLD): calm copy, mic button (Web Speech) and a text box; Submit. Loading: "Listening..." / "Checking...". Result: scam name in large type, rebuttal, statistic with source tag, "Waiting for Priya" with Cancel.
- **Hard stop** (tier STOP): named rebuttal, no proceed button, Call Priya.
- **Receipt (duress)**: "Payment under bank verification", reference TRC-nnnn, 30-minute window, subtle SIMULATED tag. Then the interview opens beneath it.
- **Blocked (immune)**: shield, "This account was reported N minutes ago by another TRACE user. Payment not started."
- **Success**: tick, reference, amount, payee.
- **Verified search**: typing "customer care" shows a verified card (number, in-app help) above any results, with "Never call a number from search results."
- **Drill**: incoming call sheet marked DRILL after the fact; three choices; lesson card.

## /guardian (Priya)

- **Idle**: "Nothing needs you" with Lakshmi's last activity.
- **Request**: amount, payee, score pill, the five markers, the interview answer, Approve / Veto (large). Decision confirmed state.
- **Call joined**: "You are on the call with Amma" state while conferenced.
- **Alert (duress)**: "Amma used her safety PIN" with the same request card.

## /stage (projector)

Tabs: Call, Coercion, Trace, Network. Auto-follows the beat; presenter can pin a tab.

- **Call**: transcript column; five marker lamps; risk bar; attestation status; reputation of the number; live mic toggle.
- **Coercion**: score dial with the six contributions as bars; tier; classification result when present; guardian decision when present.
- **Trace**: golden-hour clock; tree (hop columns); ledger table: account, received, balance, taint, held, free; recovered total; Confirm incident button state.
- **Network**: immune VPAs with time since report; script signatures; campaign banner; threshold shift.

Loading: each tab shows its last state while polling; empty states say what will appear ("The tree appears when Beat 4 starts").

## /presenter

Beats 1-5 as large buttons with the current beat highlighted; Reset; live toggles: Start/Stop call, Remote app on/off, Inject pasted payee, Advance trace, Confirm incident, Run drill; event log (last 30 events). Role header sent on every action.

## Accessibility

Focus rings visible; all buttons keyboard reachable; colour never the only signal (icons and words too); large-text toggle persists in localStorage.
