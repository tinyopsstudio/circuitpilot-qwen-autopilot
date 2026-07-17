# Security model

## Trust boundaries

Incident messages, payloads, logs, model output, and model-selected tool arguments are untrusted. Qwen does not receive production credentials and cannot directly change workflow state.

## Controls

1. **Pre-prompt redaction.** Email addresses become stable one-way aliases. Bearer tokens, API-key patterns, basic-auth credentials, and secret-shaped object fields are removed recursively.
2. **Bounded tools.** The model sees four function definitions. Each function reads only the in-memory incident fixture. There is no shell, arbitrary network, file-write, credential, payment, or production connector capability.
3. **Argument containment.** Connector health checks can address only connectors already present in the current workflow. Time windows and batch sizes are clamped.
4. **Structured plan validation.** The final response must be a JSON object. Text lengths, confidence, evidence, action count, and parameters are normalized before policy evaluation.
5. **Independent policy.** Risk and approval requirements come from a static action catalog, not the model. Unknown actions are blocked.
6. **Human checkpoint.** Workflow pauses, replays, mapping changes, retry policy changes, idempotency changes, and credential handoffs all require explicit approval.
7. **Sandbox execution.** Approved actions mutate only a cloned demo workflow. Credential rotation creates a handoff and never handles secrets.
8. **Auditing.** Incident acceptance, diagnostics, plan creation, fallback activation, and operator decisions emit sanitized structured events for Function Compute logging.
9. **Browser hardening.** The server sets a restrictive content security policy, clickjacking protection, no-referrer behavior, and MIME sniffing protection.

## Failure behavior

If a live Qwen request times out or fails validation, CircuitPilot marks the run as degraded and uses a deterministic fixture planner. The interface labels that state. It does not silently present fallback output as a Qwen result.

## Deliberate exclusions

- No production workflow credentials.
- No arbitrary URL fetcher or webhook sender.
- No direct remediation against external systems.
- No automatic replay of business records.
- No secret persistence in application state or logs.
- No claim that the in-memory demo store is production persistence.

For a production rollout, run state should move to an encrypted durable store with tenant isolation, authenticated operator roles, signed approval requests, and connector-specific least-privilege service accounts.
