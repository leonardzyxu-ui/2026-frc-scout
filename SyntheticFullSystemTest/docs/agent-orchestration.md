# Agent Orchestration Plan

This framework supports agents, but it should not waste agents.

The core replay must be deterministic code. Agents are for bounded research, UI verification, logic review, report writing, and hard debugging.

## Default Policy

Do not spawn six LLM agents per match. That is slow, expensive, and less repeatable than deterministic scout-persona simulation.

Instead:

- Use code to generate six scout observations per match.
- Use agents to inspect failures, review schema coverage, and verify UI surfaces.
- Record every launch and close in `codex_swarm.md` and `codex_agent_reports/`.

## Standard Roles

### Conductor

- Model: strongest available Codex model.
- Reasoning: high or xhigh.
- Scope: owns safety, queue, integration, and final report.
- Edit permission: unrestricted within the requested repo scope.
- Done condition: framework run passes and report is integrated.

### Event Data Historian

- Model: small or medium Codex model.
- Reasoning: medium.
- Scope: read-only fixture discovery, event source inventory, cache gaps.
- Why not stronger: source inventory is bounded and mostly mechanical.
- Done condition: report lists candidate events, required caches, and missing data.

### Event Clock Runner

- Model: medium Codex model.
- Reasoning: medium.
- Scope: implement or verify checkpoint ordering and no-future filters.
- Done condition: tests prove later records are rejected at earlier checkpoints.

### Scout Persona Simulator Reviewer

- Model: medium Codex model.
- Reasoning: medium.
- Scope: review generated pre-scout, pit-scout, and match-scout records for feasibility.
- Done condition: report flags overloaded fields and impossible observations.

### Web App Driver

- Model: small or medium Codex model.
- Reasoning: low or medium.
- Scope: Playwright/browser route checks only.
- Done condition: screenshots, console-error summary, and route assertions are recorded.

### PowerScout Driver

- Model: small or medium Codex model.
- Reasoning: low or medium.
- Scope: SwiftPM build/test, launch verification, app screenshot hooks.
- Done condition: SwiftPM result plus UI proof when enabled.

### Model Regression Analyst

- Model: strong Codex model.
- Reasoning: high.
- Scope: compare metrics, detect regression causes, propose model changes.
- Done condition: explains metric movement and recommends keep/revert/tune.

### Leakage Auditor

- Model: strong Codex model.
- Reasoning: high.
- Scope: inspect data availability and prediction checkpoints.
- Done condition: either signs off no future leakage or names exact leaking field and checkpoint.

## Subagent Launch Record

Every subagent launch should record:

- name
- role
- model
- reasoning effort
- task id
- scope
- edit permission
- expected output
- done condition
- safety constraints

## Subagent Close Record

Every subagent close should record:

- name
- task id
- status
- files read
- commands run
- files changed
- verification result
- report path
- safety concerns

## Current Framework Creation

No subagents were spawned for the initial framework creation. The work was more efficient as a single integrated architecture and harness pass.

