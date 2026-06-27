# Scouting Matchday Operator Card

Use this as the head-scout checklist when the room gets loud.

## Start Of Day

1. Export the proxy if you are checking GitHub, Firebase, or relay health:

   ```sh
   export https_proxy=http://127.0.0.1:7890 http_proxy=http://127.0.0.1:7890 all_proxy=socks5://127.0.0.1:7890
   ```

2. Run `npm run check:head-scout`.
3. Open Admin V4: <https://scout-rebuilt-2026.web.app/adminv4>.
4. Set the Competition Phase: Practice Matches, Qualifications, or Alliance Selection Prep.
5. Follow Admin V4 -> Now before touching deeper dashboards.

## Practice Matches

- Use Practice Matches phase so Matches can show practice forecasts before qualification backtests exist.
- Before each practice block, open Now -> Prediction checkpoint and save a Forecast Snapshot.
- After each block, export the full evidence workbook and keep the Forecast Ledger as the timestamped prediction record.
- Use practice results to tune confidence, evidence gaps, and collection assignments before real qualifications.

## Qualifications

- Before each match block, save a Forecast Snapshot from Model Trust.
- Use Reports -> Prediction Ledger Closeout when the model lead needs the snapshot plus workbook export path in one place.
- Review Matches for future simulations and Data -> Collect Evidence for missing rows.
- If predictions are wrong, compare Forecast Ledger rows against Model Validation and Trust Calibration instead of relying on memory.

## Judges Or Visitors

- Press `Shift+D` in Admin V4 to jump to Reports with Model Demo Proof spotlighted.
- Good surfaces to show: Model Demo Proof, Data -> Model Trust, Visualize, and Admin V2 Prediction vs Actual.
- Admin V2 legacy graph: <https://scout-rebuilt-2026.web.app/adminv2/prediction-vs-actual>.
- Keep it framed as normal scouting proof: model trust, validation, evidence, and limitations.
- For a deck background, run `npm run capture:ppt-background` and use `output/playwright/scouting-ppt-background-analytics.png`.

## Alliance Selection

- Switch Competition Phase to Alliance Selection Prep.
- Open Pick List and keep Live Pick Status Entry ready.
- After every public pick, immediately mark Our Pick, Taken, Declined, Unavailable, or Clear.
- Work the Live Pick Call Sheet in order: Primary choice, Backup choice, Swing choice, then Blocker choice.
- Use Blocker choice when denying an opponent-denial threat is more valuable than a normal fit pick.
- Recheck role fit, expected range, floor, ceiling, risk, defense impact, and seed mode after every status change.

## Relay Posture

- Firebase remains the official record.
- If The Button still reports HTTP 404, use DirectChat backup relay drafts from Admin V4 Settings.
- Do not put relay secrets in Firebase client code.
- For passive monitoring, run `npm run watch:head-scout`; export `SCOUTING_TBA_AUTH_KEY` if you want live TBA polling too.
