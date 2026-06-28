# Scout System Audit

Agent note: the original scout-system auditor, `Ampere`, was an explorer on `gpt-5.3-codex-spark` with medium reasoning. It errored because its response exceeded output limits, so this report is the main-thread audit based on repo inspection.

## Honest Readiness

### Pre Scout

Coverage exists. `src/views/PreMatchView.tsx` can load event team profiles, TBA/public context, missing information, manual-only gaps, exports, and admin-task evidence. It is the correct place to move slow research.

Weakness: it is still not dominant enough. It should create clearer before-event outputs: team priors, pit priorities, match-watch questions, and claim-verification tasks.

### Pit Scout

Coverage exists. `src/views/PitScoutView.tsx` collects robot architecture, scoring prior, endgame, chassis, mechanism fields, notes, QR backup, local archive, and Firebase writes.

Weakness: pit scout currently mixes objective facts and self-reported capability. Objective fields like turret count or visible mechanism specs are trustworthy if observed by our scout. Claimed fields like expected scoring, points contributed, or defense value should be labeled as claims and discounted until match scout verifies them.

### Match Scout

Coverage is strongest. `src/views/MatchScoutV4View.tsx` captures points, cycles, role, defended team, defender faced, defense intensity/duration, fouls, tech fouls, failures, reliability, notes, strategy notes, QR backup, and admin handoff context.

Weakness: it is at overload risk. Match scout can capture the most valuable live truth, but one scout in one match cannot be asked to capture everything with high accuracy. The form should keep live-only data prominent and push research/claim context earlier.

## Data We Want

### From Pre Scout

- Team history, event history, media, awards, rankings, public robot context, and trend lines.
- Prior expected role: offense, defense, support, specialist, or unknown.
- Pit priority list: what must be photographed, measured, or asked.
- Match-watch questions: what live scouts should verify.

### From Pit Scout

- Objective observations: drivetrain, mechanisms, turret count, endgame hardware, robot photos, visible constraints, repair readiness.
- Claimed capability: expected points, expected defense denial, auto modes, preferred role, cycle claims.
- Confidence label: observed, claimed, uncertain, or needs match verification.

### From Match Scout

- Actual live capability: real contribution, cycles, role, and behavior under defense/traffic.
- Reliability and recovery: death, comms, mechanism failure, tipping, slow reset, driver reaction.
- Defense impact: who was affected, whether points were really denied, and foul risk.
- Contradictions: pit/pre-scout claims confirmed or disproven.

## Interface Recommendation

The scout interface should lead with three lanes:

1. Pre Scout: push work here first.
2. Pit Scout: facts beat claims.
3. Match Scout: only live truth.

Defense Scout should remain a focused special case, not a fourth generic data bucket.
