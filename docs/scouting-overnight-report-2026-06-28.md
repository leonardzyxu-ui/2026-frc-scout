# Scouting Overnight Report Draft - June 28, 2026

Draft status: refresh live status before the 8:30 AM report.

## Executive Pitch

After our overnight work, the scouting product moved from "a powerful dashboard" toward "a competition operating system." The official Firebase site now has explicit surfaces for practice matches, qualifications, alliance-selection prep, prediction evidence, judge-friendly model proof, relay readiness, and morning status checks.

The strongest business value is speed plus trust: the head scout can act quickly during noisy match blocks, while still preserving the evidence needed to defend predictions later.

## What Users Can Now Do

- Open Admin V4 and choose the live operating phase: Practice Matches, Qualifications, or Alliance Selection Prep.
- Use a Now-screen Prediction checkpoint to jump directly to Model Trust before or after a match block.
- Save deliberate Forecast Snapshot checkpoints and export a full evidence workbook with a Forecast Ledger.
- Restore Admin V2's legacy Prediction vs Actual graph directly at `/adminv2/prediction-vs-actual`.
- Use fast alliance-selection status entry for Our Pick, Taken, Declined, Unavailable, and Clear.
- Use Reports -> Prediction Ledger Closeout when the model lead needs the snapshot plus workbook export path in one place.
- Run one local morning command, `npm run check:head-scout`, for official-site readiness, Admin links, relay status, latest CI, and operating cues.
- Use copy-only relay outbox drafts without putting relay credentials into public Firebase code.

## Why It Is Better

- Prediction history is now time-stamped instead of memory-based.
- Alliance-selection updates are faster and less error-prone because status changes have a dedicated live entry path.
- Judge/demo proof is available without making the workspace look staged only for judges.
- The deployed site is verified by a smoke check that resolves real service-worker assets and checks deployed bundle markers.
- Relay work is safer: DirectChat is available as backup, while The Button is correctly documented as a deployment-target issue instead of silently trusted.

## Morning Evidence To Refresh

Run:

```sh
export https_proxy=http://127.0.0.1:7890 http_proxy=http://127.0.0.1:7890 all_proxy=socks5://127.0.0.1:7890
npm run check:head-scout
```

Expected posture from the last overnight check:

- Official site: READY.
- Admin V2 route: HTTP 200.
- Admin V4 route: HTTP 200.
- Latest CI: success.
- DirectChat backup relay: HTTP 200.
- The Button primary relay: HTTP 404; treat as blocked until Render service URL/deployment is verified.

## Blocked Item

The Button is not currently serving the expected Node relay at its public Render URL. Local source confirms `/health` exists, but `https://the-button.onrender.com/health` returns a Django-style 404. Use DirectChat as backup in the morning and keep The Button out of the critical path until its Render deployment target is fixed.
