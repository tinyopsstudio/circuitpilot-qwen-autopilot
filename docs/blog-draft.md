# Building a Qwen agent that cannot approve its own changes

Workflow incidents are messy. A useful alert might contain a 401 response, a queue that doubled in ten minutes, a renamed payload field, or two successful writes with the same event ID. The operator has to connect those facts quickly, but the wrong remediation can be more expensive than the original failure.

For the Global AI Hackathon Series with Qwen Cloud, TinyOps Studio built CircuitPilot: an incident response agent that uses Qwen for evidence-driven diagnosis while keeping authority in deterministic software.

## The design constraint

We started with one rule: the model must not be able to approve its own changes.

That sounds simple, but it changes the architecture. A prompt that says "ask before changing production" is not enough. Incident text and logs are untrusted, model output can be malformed, and a tool call can carry surprising arguments. The enforcement boundary has to sit outside the model.

CircuitPilot divides the job into four layers:

1. **Redaction.** Tokens, basic-auth credentials, secret-shaped fields, and email addresses are removed before context reaches Qwen or the audit log.
2. **Reasoning.** Qwen receives the redacted incident, verified baseline evidence, and four read-only diagnostic functions.
3. **Policy.** A static catalog assigns risk and approval requirements to every proposed action. Unknown action names are blocked.
4. **Execution.** Approved actions mutate only an isolated workflow sandbox. Credential rotation creates a handoff and never handles credential material.

## Why sequential tool calls

CircuitPilot disables parallel tool calls. Qwen selects one bounded diagnostic, receives the result, and decides whether it needs another. This creates a causal trail an operator can inspect:

```text
incident accepted
baseline graph check
blast-radius estimate
Qwen selected payload-contract inspection
verified tool result returned
Qwen produced JSON plan
policy created two approval requests
```

The approach is slower than firing every check at once, but it makes the reasoning path visible and avoids unnecessary diagnostics.

## A model proposal is not an action

Qwen returns a structured plan with a diagnosis, confidence, evidence references, and up to three proposed actions. CircuitPilot then discards any model-supplied risk label and looks up the action in its own catalog.

For example, `add_idempotency_guard` is always a medium-risk, approval-required sandbox action. `rotate_connector_credential` is always a high-risk manual handoff. `run_shell_command` does not exist, so it is blocked even if model output contains a convincing rationale.

This separation lets the model remain flexible about diagnosis while keeping execution behavior small and testable.

## Four failure classes

The demo includes four synthetic but operationally realistic incidents:

- An expired CRM token causing repeated 401 responses.
- A checkout payload that renamed `shipping_address` to `shippingAddress`.
- A rate-limit event amplified by aggressive retries.
- A payment webhook accepted twice because the workflow lacks idempotency.

The deterministic safety benchmark makes four assertions per scenario: correct category, expected remediation type, approval coverage, and redaction. The current result is 16/16.

## Honest degraded mode

External model calls fail. If Qwen times out or returns an invalid plan, CircuitPilot activates a deterministic fixture planner through the same tools, policy, approval, and audit path. The run is marked degraded in both the API and interface. Fallback output is never presented as a live Qwen result.

## Running on Alibaba Cloud

The application is packaged as a Node.js 20 custom runtime for Alibaba Cloud Function Compute. The browser, HTTP API, agent loop, policy engine, sandbox, and structured audit logging run in one function. Qwen Cloud remains the reasoning service. A Serverless Devs 3 manifest in the public repository makes the deployment reproducible.

## What we would change for production

The demo intentionally keeps state in memory and executes only against fixtures. A production version needs encrypted tenant-isolated persistence, authenticated operator roles, signed and expiring approvals, connector-specific least-privilege accounts, and a larger blinded evaluation set.

The broader lesson is that an operational AI agent does not need unrestricted authority to be useful. Qwen handles the ambiguous part: deciding what evidence matters and connecting it into a diagnosis. Deterministic software handles the irreversible part: deciding what is allowed.

Published article: https://tinyopsstudio.com/building-qwen-agent-human-approval

Source: https://github.com/tinyopsstudio/circuitpilot-qwen-autopilot

Live demo: `[ADD FUNCTION COMPUTE URL]`
