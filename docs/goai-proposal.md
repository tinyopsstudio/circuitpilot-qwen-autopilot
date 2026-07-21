# CircuitPilot for GOAI Agent Infra

## Project summary

CircuitPilot is an evidence-first multi-agent incident response system for enterprise automation. It turns a noisy workflow failure into a bounded diagnosis, a reversible recovery plan, an explicit approval decision, a verified execution result, and a reusable incident record.

The project targets the GOAI Agent Infra zero-touch operations direction. It is designed for workflow platforms and integration-heavy business systems where an incorrect automated fix can amplify the original incident.

The current open-source implementation already provides a working incident queue, redacted evidence collection, Qwen-powered diagnosis, deterministic policy enforcement, human approval checkpoints, sandbox execution, rollback instructions, and structured audit events. The GOAI work extends that foundation into an AgentTeams-based collaboration loop with four specialized agents and one non-agent policy boundary.

## Problem

Workflow incidents arrive as fragmented signals: HTTP errors, connector health changes, payload drift, queue growth, retries, and business-impact estimates. Operators must answer five questions quickly:

1. Which signals describe the same incident?
2. What evidence supports the suspected root cause?
3. What is the smallest reversible remediation?
4. Which actions require approval?
5. Did the change restore service without creating new harm?

A single unconstrained agent is a poor fit for this work. It can mix evidence gathering with remediation authority, accept untrusted log content as instruction, or declare success without independent verification. CircuitPilot separates those responsibilities and makes every handoff inspectable.

## Multi-agent design

### 1. Triage Coordinator

- Normalizes and deduplicates alerts into an `IncidentEnvelope`.
- Assigns severity, affected workflow, time window, and investigation objective.
- Routes only the minimum redacted context needed by downstream agents.
- Owns the incident state machine, not the diagnosis or execution decision.

### 2. Evidence Investigator

- Calls read-only tools for workflow graph inspection, connector health, failure-window search, payload-contract comparison, retry pressure, and blast-radius estimation.
- Produces an `EvidenceBundle` with source, timestamp, digest, and uncertainty for every claim.
- Treats logs, payloads, and tool results as untrusted data.
- Cannot propose or execute a state-changing action.

### 3. Recovery Planner

- Converts the evidence bundle into a diagnosis and up to three bounded actions.
- Selects only actions in the deterministic action catalog.
- Supplies expected outcome, preconditions, verification checks, and rollback for every action.
- Cannot approve its own plan or bypass policy.

### 4. Recovery Verifier

- Receives an execution receipt and compares before-and-after evidence.
- Checks service recovery, queue health, duplicate risk, and expected outcome.
- Recommends close, continue observation, or rollback.
- Cannot rewrite the original evidence or silently broaden the action scope.

### Deterministic Policy Gate

The policy gate is intentionally not an agent. It validates action type, risk, permission scope, approval requirement, idempotency key, and execution target. Unknown actions fail closed. Consequential actions stop for an explicit operator decision. Execution is bounded to an isolated workflow copy until a production adapter is deliberately configured.

## AgentTeams mapping

The Triage Coordinator maps to the AgentTeams team manager. The Investigator, Planner, and Verifier map to role-specific workers with separate tools and context scopes. Typed artifacts move between tasks instead of sharing unrestricted conversation history:

`IncidentEnvelope -> EvidenceBundle -> RemediationPlan -> ApprovalDecision -> ExecutionReceipt -> VerificationReport`

Every task transition emits an audit event with the input digest, output digest, actor, tool calls, elapsed time, and resulting state. AgentTeams supplies role orchestration and status tracking; CircuitPilot supplies the domain Skill, tool contracts, policy boundary, evidence schema, and recovery state machine.

## Reusable Skill

The `workflow-incident-response` Skill packages the complete loop as a reusable capability. It defines:

- Input schema for incident signals, workflow topology, allowed tools, and policy profile.
- Output schema for evidence, diagnosis, plan, approvals, execution receipt, and verification.
- Read-only diagnostic tool contracts and bounded action contracts.
- Permission scope, retry limits, idempotency controls, audit events, and fallback behavior.
- A fail-closed rule when evidence is insufficient, a tool fails, or an action is unknown.

The Skill is vendor-neutral. Adapters can map the same contract to n8n, Make, Zapier, internal workflow engines, ITSM systems, or cloud automation APIs without changing the agent roles.

## Current evidence

- Working Node.js application and operator interface.
- Qwen Cloud integration through an OpenAI-compatible tool-calling endpoint.
- Six bounded read-only diagnostics and eight policy-catalog actions.
- Secret, bearer token, basic-auth URL, and email redaction before prompts and logs.
- Human approval for every state-changing or credential-related action.
- Sandbox-only execution with before-and-after workflow state.
- Structured incident timeline and audit events.
- Deterministic benchmark: 16 of 16 assertions pass across connector authentication, payload drift, retry amplification, and missing idempotency.
- MIT-licensed public repository with tests, deployment configuration, and architecture documentation.

## Preliminary-to-final plan

### Preliminary

- Submit the problem framing, multi-agent architecture, Skill contract, safety model, current demo evidence, and implementation plan.
- Keep claims grounded in the existing repository and benchmark.

### Semifinal

- Implement the four roles on AgentTeams.
- Add typed context packets, task-state persistence, tool permission profiles, and recovery verification.
- Publish a reproducible local demo and one external workflow adapter.
- Expand the incident corpus and report diagnosis accuracy, unsupported-claim rate, approval precision, recovery success, rollback success, and latency.

### Final

- Demonstrate alert intake through verified recovery in a live workflow incident.
- Show policy denial, operator rejection, approved execution, failed verification, and rollback paths.
- Publish the AgentTeams adapter, reusable Skill, evaluation corpus, and audit viewer under an open-source license.

## Why this matters

CircuitPilot makes multi-agent operations useful by making it accountable. Specialized agents reduce role conflict, typed handoffs limit context sprawl, deterministic policy prevents self-approval, and independent verification turns a proposed fix into a measurable recovery. The result is a reusable incident-response capability that enterprises can inspect before they trust it.

