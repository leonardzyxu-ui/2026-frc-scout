# Logic Red-Team Prompt Review 002

- Agent: Pauli
- Agent id: `019f10c1-8ba7-7be1-be08-7b85068e87ed`
- Role: explorer / logic red-team
- Model: `gpt-5.4-mini`
- Reasoning effort: high
- Edit permission: read-only
- Status: completed

## Purpose

Read Leo's pasted overnight prompt and identify logical loopholes, impossible states, and safety invariants for the scouting redesign.

## Critical Findings

1. Defense credit can become circular and selection-biased if `Defense = expected undefended output - actual defended output` is derived from already-defended historical data.
2. Official-score reconciliation can manufacture fake truth if it scales the wrong bucket, handles zero totals poorly, or mixes penalties/support/defense into raw offense scoring.
3. Scout-count assumptions conflict unless the system explicitly supports arbitrary `N` scouts per match and routes by match membership.
4. First-shift disagreement needs an authority/adjudication rule, not just a re-ask loop.

## High Findings

1. Defender percentage normalization must conserve one defended event and handle all-zero shares.
2. Stockpile is double-countable unless support remains non-additive or one primary bucket is enforced.
3. Defense saturation must make extra defense zero marginal value once opponent offense is exhausted.

## Medium Findings

1. Smart-gamble variance needs bounded/truncated/correlated distribution thinking, not only mean and standard deviation.
2. Ranking-point thresholds should be rule-set driven instead of baked into code.

## Integration Response

Added explicit missing slices and invariants to the prompt decomposition and task queue. Existing code already covers some guardrails: defense saturation, all-zero defender split, and first-shift V4 adapter. Remaining work is captured as queue items.

## Safety Notes

No files were changed by the agent. No credentials, pushes, deploys, or protected file edits were performed.

