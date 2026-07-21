# GOAI Skill Inventory

This inventory follows Appendix B of the GOAI Agent Infra handbook.

| Field | CircuitPilot definition |
| --- | --- |
| Skill name | `workflow-incident-response` |
| Skill type | Custom reusable Skill with external-tool contracts |
| Use case | Investigate enterprise workflow failures, propose bounded reversible recovery, enforce approval policy, and verify outcomes. |
| Input parameters | Incident ID, severity, signal window, objective, redacted workflow graph, bounded signals, allowed tools, and policy profile. |
| Output result | Evidence bundle, diagnosis, remediation plan, approval request, execution receipt, verification report, and reusable incident record. |
| Invocation conditions | A workflow alert or operator request identifies a bounded incident and an allowed diagnostic scope. |
| Dependent tools and systems | Six read-only diagnostic contracts, eight catalog action contracts, Qwen planner, policy gate, sandbox executor, and audit store. The semifinal plan adapts these contracts to MCP without redesigning the Skill. |
| Failure handling | Quarantine malformed input; retry read-only transient failures at most twice; never retry state-changing actions implicitly; return `insufficient_evidence` or `no_safe_plan`; preserve partial evidence. |
| Permissions and safety | Least-privilege tool scopes; redaction before model access; deterministic action allowlist; explicit approval for consequential actions; incident-scoped idempotency; rollback required; unknown actions fail closed. |
| Reuse value | The same typed workflow applies to integration, CI/CD, cloud, data-pipeline, billing, and security incidents by swapping bounded tool adapters and policy profiles. |

The complete reusable instruction contract is in [`../skills/workflow-incident-response/SKILL.md`](../skills/workflow-incident-response/SKILL.md).

