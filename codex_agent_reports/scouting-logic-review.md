# Scouting Logic Review

The overall philosophy is represented well in `PowerScout` (`ScoutLane`, `EvidenceTrust`, and the lane copy all push pre-scout early, separate pit claims from facts, and keep match scout on live truth). I did not find a blocking mismatch there.

## Findings

1. **High - Match scout can submit without a role**
   `MatchScoutV4View` validates username, team, assignment, and alliance, but not `rolePlayed`. The role buttons also have no explicit `Unknown`/`Not seen` choice, while the normalizer accepts `''`. That means a row can be saved with points and defense fields but no role, even though `PpaSignalStrip` and admin logic depend on it.
   Fix: require a role before submit, or add an explicit unknown state and handle it everywhere.
   Refs: [`src/views/MatchScoutV4View.tsx:619-623`](../src/views/MatchScoutV4View.tsx#L619), [`src/views/MatchScoutV4View.tsx:972-980`](../src/views/MatchScoutV4View.tsx#L972), [`src/utils/matchScoutingV4.ts:20-23`](../src/utils/matchScoutingV4.ts#L20)

2. **High - Pit scoring fields silently rewrite each other**
   `handleBallFieldChange()` auto-inferrs `expectedHubBallsPerMatch`, `expectedAutoBalls`, and `expectedTeleopBalls` from edit order. If a scout types a total, then a split, the form rewrites one of the values instead of preserving the scout's uncertainty. That makes a claimed estimate look more exact than it really is.
   Fix: separate total from split, or only reconcile on an explicit confirm action.
   Refs: [`src/views/PitScoutView.tsx:591-634`](../src/views/PitScoutView.tsx#L591)

3. **Medium - Defense attribution fields are semantically overloaded**
   The match defense logic uses both `defendedTeamNumber` and `defenderFacedTeamNumber`, and `strategyBrain` changes the meaning of the record depending on which one is filled first. The UI labels do not make that fallback behavior obvious, so a scout can easily fill both fields thinking both are authoritative.
   Fix: collapse this into one canonical matchup structure, or make the target/defender semantics explicit in the form.
   Refs: [`src/views/MatchScoutV4View.tsx:984-998`](../src/views/MatchScoutV4View.tsx#L984), [`src/utils/strategyBrain.ts:1141-1146`](../src/utils/strategyBrain.ts#L1141)

4. **Medium - Defense metric uses the default as the completion sentinel**
   `initialMatchDefenseScoutingV1` sets `defenseMetric` to `0.5`, and `getDefenseStepReadiness()` treats `0.5` as "not touched yet." A real neutral read is therefore indistinguishable from an untouched form and the step indicator will keep looking incomplete.
   Fix: track dirty/touched state separately, or add an explicit neutral/unknown option instead of using the midpoint as the sentinel.
   Refs: [`src/types.ts:731-746`](../src/types.ts#L731), [`src/views/MatchDefenseScoutView.tsx:158-166`](../src/views/MatchDefenseScoutView.tsx#L158)

## Short version

The web flow is mostly aligned with the design philosophy, but the highest-risk logic gaps are still about trust: one match form can submit without a role, pit values can be rewritten by the form, and defense rows still have a few places where the UI and downstream meaning diverge.

## Fix Status

- Fixed: Match Scout now requires `rolePlayed` before submit, so scoring rows cannot land without role context.
- Fixed: Pit Scout no longer silently rewrites scoring total/split fields. It now shows an explicit mismatch warning and lets the scout choose whether to reconcile total to auto plus teleop.
- Fixed: Defense Scout now tracks whether the defense metric slider was touched separately from the numeric value, so a real neutral `0.5` read can count as completed.
- Follow-up: Defense attribution still needs a deliberate schema/UI cleanup because `defendedTeamNumber` and `defenderFacedTeamNumber` have overlapping semantics across Match Scout and `strategyBrain`.
