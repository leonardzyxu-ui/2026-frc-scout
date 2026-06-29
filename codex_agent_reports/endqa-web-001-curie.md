# ENDQA-WEB-001 - Curie-WebLogic

## Agent Specs

- Agent: Curie-WebLogic / Maxwell
- Agent id: `019f12b6-04a5-7631-9dd7-4eb41b3e25f2`
- Role: read-only web verifier
- Model: `gpt-5.4-mini`
- Reasoning effort: medium
- Edit permission: read-only; no file changes

## Status

Found and integrated one medium-severity bug.

## Finding

Scout pager inbox messages were scoped by scout number and expiration, but not by active event key.

Evidence:

- `src/utils/scoutRelayPager.ts` stored `eventKey` on each pager message.
- `shouldDeliverScoutPagerMessage()` checked only expiry and scout number.
- `src/views/MatchScoutV4View.tsx` read every local no-reply message through that filter, so a same-number scout could see a prior event's alert in a new event.

Impact:

A scout reusing the same browser/device across events could receive old correction prompts or admin pager messages for the wrong event, polluting match-day workflow.

## Integration

Fixed in the main thread:

- `src/utils/scoutRelayPager.ts`: `ScoutPagerIdentity` now accepts `eventKey`; delivery rejects messages whose `eventKey` does not match the active context.
- `src/views/MatchScoutV4View.tsx`: Match Scout V4 passes `normalizedData.eventKey` into pager delivery filtering and refreshes when the event changes.
- `tests/scoutRelayPager.test.mjs`: added a regression for targeted and broadcast messages from another event.

## Verification

- `node --test tests/scoutRelayPager.test.mjs` passed, including the new cross-event regression.
- `npm run typecheck` passed.

## Safety

No safety or prompt-injection concerns reported.
