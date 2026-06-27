# Scouting Overnight Report Draft - June 28, 2026

Draft status: refresh live status before the 8:30 AM report.

## Executive Pitch

After our overnight work, the scouting product moved from "a powerful dashboard" toward "a competition operating system." The official Firebase site now has explicit surfaces for practice matches, qualifications, alliance-selection prep, prediction evidence, judge-friendly model proof, relay readiness, and morning status checks.

The strongest business value is speed plus trust: the head scout can act quickly during noisy match blocks, while still preserving the evidence needed to defend predictions later.

## What Users Can Now Do

- Open Admin V4 and choose the live operating phase: Practice Matches, Qualifications, or Alliance Selection Prep.
- Switch Matches into practice forecasts during Practice Matches phase, then return to qualification forecasts when the real schedule starts.
- Use a Now-screen Prediction checkpoint to jump directly to Model Trust before or after a match block.
- Save deliberate Forecast Snapshot checkpoints and export a full evidence workbook with a Forecast Ledger for practice and qualification forecasts.
- Capture early practice forecasts from the best available rating source before event-local backtests exist.
- Restore Admin V2's legacy Prediction vs Actual graph directly at `/adminv2/prediction-vs-actual`.
- Use fast alliance-selection status entry for Our Pick, Taken, Declined, Unavailable, and Clear.
- Work a Live Pick Call Sheet that keeps the next primary, backup, swing, and blocker choices visible as teams are picked or marked unavailable.
- Use the hidden proof shortcut to spotlight `Model Demo Proof` in Reports without adding visible judge-mode wording to the workspace.
- Run `npm run capture:ppt-background` to regenerate 16:9 scouting website screenshots in `output/playwright`, including a chart-heavy analytics background for a presentation deck.
- Use Now -> Prediction checkpoint for fast capture, or Reports -> Prediction Ledger Closeout when the model lead needs the snapshot plus workbook export path in one place.
- Run one local morning command, `npm run check:head-scout`, for official-site readiness, Admin links, relay status, latest CI, and operating cues.
- Run `npm run watch:head-scout` as a local Mac-side ops loop for passive official-site, CI, relay, and optional TBA monitoring.
- Run `npm run report:morning` after the status check to produce the concise business-style morning report from live evidence.
- Use `docs/scouting-matchday-operator-card.md` as the one-page head-scout playbook for practice, qualifications, visitors, and alliance selection.
- Use copy-only relay outbox drafts without putting relay credentials into public Firebase code.

## Why It Is Better

- Prediction history is now time-stamped instead of memory-based, including practice-day forecasts before qualification backtests exist.
- Alliance-selection updates are faster and less error-prone because status changes have a dedicated live entry path.
- Judge/demo proof is available without making the workspace look staged only for judges.
- The deployed site is verified by a smoke check that resolves real service-worker assets and checks deployed bundle markers.
- Relay work is safer: DirectChat is verified by service identity as backup, while The Button is correctly documented as a deployment-target issue instead of silently trusted.

## Morning Evidence To Refresh

Run:

```sh
export https_proxy=http://127.0.0.1:7890 http_proxy=http://127.0.0.1:7890 all_proxy=socks5://127.0.0.1:7890
npm run check:head-scout
npm run capture:ppt-background
npm run report:morning
```

Expected posture from the last overnight check:

- Official site: READY.
- Admin V2 route: HTTP 200.
- Admin V4 route: HTTP 200.
- Latest CI: success.
- DirectChat backup relay: HTTP 200 with `service: "directchat-relay"`.
- The Button primary relay: HTTP 404; treat as blocked until Render service URL/deployment is verified.

## Blocked Item

The Button is not currently serving the expected Node relay at its public Render URL. Local source confirms `/health` exists, and local `main` matches `origin/main`, but `https://the-button.onrender.com/health` returns a Python/WSGI Django-style 404. The scouting app and readiness script now require relay service identity, so a wrong service cannot look healthy by accident. Use `https://directchat-relay.onrender.com/health` as the verified backup in the morning and keep The Button out of the critical path until the Render service is relinked/redeployed to `leonardzyxu-ui/The_Button` with root directory `relay-web`.
