# Three-minute demo script

Target length: 2:40 to 2:55.

## 0:00-0:15 - Problem and product

Visual: CircuitPilot incident queue and approval panel.

Narration: "Automation failures arrive as ambiguous alerts, but remediation can change customer data or replay transactions. CircuitPilot uses Qwen to diagnose the incident while deterministic policy keeps every consequential action behind human approval."

## 0:15-0:35 - Architecture

Visual: `docs/architecture.png`.

Narration: "The operator UI and agent run on Alibaba Cloud Function Compute. CircuitPilot redacts incident context, gives Qwen only bounded read-only tools, validates its JSON plan, and sends proposed actions through an independent policy engine."

## 0:35-1:25 - Live Qwen diagnosis

Visual: Select `Duplicate payment events`, then click `Diagnose incident`.

Narration: "This workflow accepted the same payment event twice. CircuitPilot first checks graph integrity and blast radius. Qwen then selects the additional evidence it needs. The result identifies missing idempotency, cites verified evidence, and proposes containment plus an event-ID guard."

Visual checkpoints:

- Provider pill shows `qwen3.7-plus live`.
- Run line shows `Qwen Cloud`, not degraded mode.
- Evidence table and timeline are visible.
- Diagnosis reads `Missing idempotency`.

## 1:25-2:00 - Human checkpoint

Visual: Approval queue. Approve `Pause payment posting`; reject or approve `Add an event ID guard`.

Narration: "Qwen cannot execute either change. The static catalog marks both as consequential, so the agent stops. After an operator approves, the action applies only to the isolated sandbox and the decision appears in the audit timeline."

Visual checkpoints:

- Pending count changes.
- Sandbox workflow status changes from active to paused.
- Timeline adds `Operator decision recorded`.

## 2:00-2:25 - Safety evidence

Visual: GitHub `docs/security.md`, tests, and benchmark output.

Narration: "Unknown actions are blocked, secrets and emails are redacted before prompting, and credential rotation never handles credential material. Unit and API tests plus a four-scenario benchmark currently pass 16 of 16 safety assertions."

## 2:25-2:50 - Deployment and close

Visual: GitHub `s.yaml`, live `/health` JSON, then return to CircuitPilot.

Narration: "The public repository includes the complete source, architecture, build log, and reproducible Function Compute deployment. CircuitPilot shows how Qwen can own ambiguous reasoning without owning irreversible authority."

## Recording checklist

- [ ] Browser zoom at 100% with no personal bookmarks or account chrome visible.
- [ ] Use only synthetic fixture data.
- [ ] Show the live Function Compute domain.
- [ ] Show one Qwen tool call and one approval decision.
- [ ] Keep video under three minutes.
- [ ] Upload publicly to YouTube, Vimeo, or Youku.
- [ ] Avoid copyrighted music and third-party marks beyond nominative product references.
