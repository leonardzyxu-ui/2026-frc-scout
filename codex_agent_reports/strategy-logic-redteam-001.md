# Strategy Logic Red-Team - Mendel

- Agent: Mendel
- Agent id: `019f0ed9-acd1-70b2-bf20-ad4ab3922ef4`
- Role: explorer/verifier
- Model: `gpt-5.4-mini`
- Reasoning effort: high
- Status: completed, closed
- Files changed by agent: none

## Highest-Priority Loopholes

1. Defense denial can be invented or inflated from weak evidence.

   Current `buildDefenseAttributions()` can produce suppression credit even when a real target scouting row is missing. The redesign should require target evidence before crediting Defense, cap denied points per match/alliance, normalize multi-defender shares, and test multi-defender fixtures.

2. Floor handling overreacts to a single zero.

   The existing profile already stores `lowestNonZeroScore`, but floor behavior still lets one dead match crush the published floor. The redesign should publish both `Floor` and `Floor Non Zero`, plus zero rate/failure context.

3. Scout confidence saturates too early.

   Five noisy rows can look strong even if they all come from one role or one streak. Confidence should include sample count, recency, role diversity, scout agreement, and official-score reconciliation quality.

4. Static role classification is brittle.

   Existing role labels can flip on hard thresholds. The new system should not pre-decide whether a team is scorer/defender/flex; it should evaluate role combinations dynamically for each match.

5. Existing strategy planning misses mixed-role combinations.

   The old strategy plan mostly compares all-offense vs one-defender cases. Leo's requested model requires brute-force or bounded search over every reasonable offense/defense/stockpile combination, including two-defender plans.

## Secondary Risks To Track

- Ranking-point logic must validate official score-breakdown schema and exact thresholds instead of silently accepting missing or shifted keys.
- Scout assignment should cap repeated same-team/consecutive exposure while preserving useful continuity.
- Coverage gaps should explain why a slot was missed: headcount, own-team priority, continuity tradeoff, or assignment conflict.
- Scout reward accounting should run invariant checks after imports/adjustments.
- Critical sync/conflict notifications should remain pinned until acknowledged and should be stored in history.

## Implementation Guardrails

- Never credit defense without the defended team's own observed or reconciled scoring basis.
- Never let defense denial exceed opponent available offense.
- Preserve `Floor` and `Floor Non Zero` as different concepts.
- Treat Contribution Deviation and Defense Deviation as first-class uncertainty, not as vague reliability.
- Run regression tests where two defenders beat one defender, one zero does not erase a strong non-zero floor, and defense share sliders normalize imperfect totals.
