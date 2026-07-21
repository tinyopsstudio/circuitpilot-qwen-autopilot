# AgentTeams design mapping

This document maps CircuitPilot's domain contracts to an AgentTeams implementation without claiming unsupported framework APIs. Exact class and method bindings will follow the released AgentTeams SDK and examples used for the semifinal implementation.

## Team topology

| CircuitPilot role | AgentTeams responsibility | Tool scope | Required output |
| --- | --- | --- | --- |
| Triage Coordinator | Team manager and task router | Alert normalization, incident lookup | `IncidentEnvelope` |
| Evidence Investigator | Read-only evidence worker | Diagnostic catalog only | `EvidenceBundle` |
| Recovery Planner | Plan worker | No execution tools | `RemediationPlan` |
| Recovery Verifier | Independent verification worker | Read-only health and comparison tools | `VerificationReport` |
| Policy Gate | Deterministic runtime boundary, not an agent | Action catalog and sandbox executor | `ApprovalRequest` or `ExecutionReceipt` |

## State machine

| State | Entered by | Exit condition | Failure behavior |
| --- | --- | --- | --- |
| `received` | Alert adapter | Incident normalized | Quarantine malformed input |
| `investigating` | Triage Coordinator | Evidence bundle reaches minimum completeness | Return `insufficient_evidence` |
| `planning` | Evidence Investigator | Valid bounded plan produced | Return `no_safe_plan` |
| `awaiting_approval` | Policy Gate | Operator approves or rejects | Expire without execution |
| `executing` | Policy Gate | Bounded action returns receipt | Stop and preserve partial evidence |
| `verifying` | Recovery Verifier | Success or rollback recommendation | Escalate with failed checks |
| `resolved` | Triage Coordinator | Verification passed | Immutable close record |
| `rolled_back` | Policy Gate | Rollback receipt verified | Escalate for manual recovery |

## Typed context packets

### IncidentEnvelope

```json
{
  "incidentId": "inc_...",
  "workflowId": "wf_...",
  "severity": "high",
  "signalWindow": { "start": "ISO-8601", "end": "ISO-8601" },
  "objective": "restore writes without losing queued records",
  "allowedDiagnosticTools": ["inspect_workflow_graph"],
  "policyProfile": "enterprise-default-v1"
}
```

### EvidenceBundle

Each evidence item includes `source`, `observedAt`, `tool`, `result`, `digest`, and `confidence`. Raw secrets are redacted before the packet is created.

### RemediationPlan

Each action includes `type`, `parameters`, `expectedOutcome`, `verificationChecks`, `rollback`, `risk`, and `evidenceDigests`. The policy gate rejects actions outside the catalog.

### ExecutionReceipt

The receipt includes the approved action digest, idempotency key, target, start and finish times, changed fields, executor result, and rollback handle.

### VerificationReport

The report contains each expected-outcome check, before and after values, pass or fail status, residual risk, and one disposition: `close`, `observe`, or `rollback`.

## Context and permission boundaries

- The Coordinator sees incident metadata and task status, not raw credentials.
- The Investigator has read-only diagnostics and cannot access action tools.
- The Planner sees redacted evidence and the action catalog, not execution credentials.
- The Verifier receives the original expected outcomes and execution receipt, not the Planner's hidden reasoning.
- The Policy Gate alone can call an action adapter, and only after an approval decision when required.
- Every tool call is bound to an incident ID, permission scope, timeout, and idempotency key.

## Runtime verification

1. Validate the packet schema and evidence digests at every handoff.
2. Reject unsupported tools, actions, targets, or widened parameters.
3. Record task state and tool results before advancing.
4. Compare execution results against explicit success checks.
5. Trigger rollback when a required check fails and a safe rollback exists.
6. Preserve a complete audit chain even when an agent or tool times out.

## Evaluation plan

The semifinal evaluation will report:

- Diagnosis category accuracy on a blinded incident corpus.
- Unsupported-claim rate and evidence citation coverage.
- Diagnostic tool selection efficiency.
- Approval precision for consequential actions.
- Recovery and rollback success rates in the sandbox.
- Median and tail latency per agent and end-to-end.
- Redaction failures and policy bypass attempts.

