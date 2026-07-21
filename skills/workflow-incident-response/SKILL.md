---
name: workflow-incident-response
description: Investigate enterprise workflow failures, propose bounded reversible recovery, enforce approval policy, and verify recovery with an auditable multi-agent loop.
version: 0.1.0
license: MIT
---

# Workflow Incident Response

Use this Skill when an automation or integration workflow is failing and the operator needs an evidence-backed diagnosis and safe recovery plan.

## Inputs

- `incident`: stable incident ID, severity, signal window, and operator objective.
- `workflow`: redacted node graph, contracts, connector names, and current status.
- `signals`: bounded logs, health snapshots, payload samples, queue state, and impact.
- `allowed_tools`: explicit diagnostic and action capabilities.
- `policy_profile`: approval rules, target restrictions, and risk thresholds.

Never accept credentials, unrestricted shell access, arbitrary URLs, or an unbounded production target as Skill input.

## Roles

1. Triage Coordinator normalizes the incident and routes typed context.
2. Evidence Investigator calls read-only diagnostics and produces an evidence bundle.
3. Recovery Planner proposes the smallest reversible action set.
4. Recovery Verifier independently checks the execution result.
5. A deterministic Policy Gate enforces permissions and approvals; it is not an agent.

## Procedure

1. Validate and redact the incident envelope.
2. Gather baseline workflow graph and blast-radius evidence.
3. Call only read-only diagnostic tools needed to resolve uncertainty.
4. Produce a diagnosis whose claims cite evidence digests.
5. Propose no more than three catalog actions, each with expected outcome and rollback.
6. Send every action through the Policy Gate.
7. Stop consequential actions at an explicit approval checkpoint.
8. Execute approved actions once using the incident-scoped idempotency key.
9. Verify before-and-after evidence independently.
10. Close, observe, or roll back; always write the final audit record.

## Outputs

- `evidence_bundle`
- `diagnosis`
- `remediation_plan`
- `approval_requests`
- `execution_receipts`
- `verification_report`
- `incident_record`

## Tool contract

Every tool declares:

- Stable name and purpose.
- JSON parameter and response schemas.
- Permission scope and target boundary.
- Timeout, retry, and idempotency behavior.
- Audit fields and redaction rules.
- Failure and fallback behavior.

Read-only diagnostics may retry twice for transient failures. State-changing tools never retry implicitly. Unknown tools or actions fail closed.

## Approval and rollback

- Notes and `no_action` records may complete automatically.
- Workflow changes, pauses, replays, credential handoffs, and other consequential actions require explicit approval.
- The Planner cannot approve or execute its own action.
- Each action must carry a rollback description before it can reach approval.
- Failed verification triggers rollback when the catalog marks rollback safe; otherwise it escalates without further action.

## Audit requirements

Record the incident ID, task state, actor role, tool name, input and output digests, decision, target, elapsed time, and result for every transition. Never record raw credentials or unredacted personal data.

## Completion criteria

The Skill completes only when the incident is verified resolved, safely rolled back, or escalated with a complete evidence record and no unauthorized action pending.

