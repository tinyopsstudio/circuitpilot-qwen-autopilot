# Devpost submission draft

## Project name

CircuitPilot

## Tagline

A Qwen-powered workflow incident agent that diagnoses failures, gathers bounded evidence, and cannot approve its own changes.

## Track

Track 4: Autopilot Agent

## Inspiration

Automation failures rarely arrive as clean bug reports. An operator sees a vague alert, several inconsistent logs, a growing retry queue, and pressure to change production quickly. General-purpose agents can help interpret that evidence, but giving the same model unrestricted diagnostics and remediation authority creates a second operational risk.

CircuitPilot explores a stricter pattern: let Qwen reason over ambiguous incidents and select useful diagnostics, while deterministic software owns data redaction, tool boundaries, risk classification, approvals, and execution.

## What it does

CircuitPilot accepts a workflow incident containing a graph, connector snapshots, a redacted sample payload, recent execution logs, and business impact. It automatically runs baseline graph and blast-radius checks, then gives Qwen Cloud four additional read-only diagnostic tools. Qwen selects the evidence it needs and returns a structured diagnosis and remediation plan.

Every proposed action passes through an independent action catalog. Unknown actions are blocked. Pauses, replays, field mappings, retry policy changes, idempotency guards, and credential handoffs all stop at a human checkpoint. Approved changes execute only against an isolated workflow sandbox and produce a structured audit event.

The operator interface shows the incident queue, workflow graph, verified evidence, Qwen diagnosis, agent timeline, approval queue, and resulting sandbox state in one screen.

## How we built it

- Node.js 20 HTTP service with no runtime dependencies.
- Qwen Cloud `qwen3.7-plus` through the OpenAI-compatible Chat Completions API.
- Sequential Qwen function calling with `parallel_tool_calls: false` for a causal audit trail.
- JSON plan generation with `response_format: {"type":"json_object"}`.
- Recursive secret, token, basic-auth, and email redaction before prompts and logs.
- Six bounded diagnostic tools; four are exposed to Qwen and two always run as baseline checks.
- Static policy catalog that owns risk, approval, and execution behavior independently of model output.
- In-memory sandbox executor for reversible demo state changes.
- Alibaba Cloud Function Compute deployment through Serverless Devs 3.
- Structured stdout audit events captured by Function Compute logging.
- Built-in Node test runner and a 16-assertion deterministic safety benchmark.

## Challenges

The hardest design problem was preserving useful agent autonomy without making safety depend on a prompt. Prompt instructions help, but they are not an enforcement boundary. CircuitPilot therefore separates reasoning from authority: Qwen can ask for bounded evidence and propose an action name, while deterministic code decides what exists, what requires approval, and what can execute.

A second challenge was keeping degraded behavior honest. If the live Qwen call fails, CircuitPilot labels the run as degraded and invokes a deterministic fixture planner through the same policy and approval path. It never presents fallback output as a live model result.

## Accomplishments

- Four complete incident classes: connector authentication, payload contract drift, retry amplification, and missing idempotency.
- 16/16 local safety benchmark assertions passing.
- Unit coverage for redaction, model-output containment, policy enforcement, sandbox isolation, approvals, Qwen tool calls, and the HTTP API.
- Responsive desktop and mobile operator UI with no console errors or viewport overflow in automated visual QA.
- Zero findings in the public-package privacy scan.
- Reproducible Function Compute manifest that passes Serverless Devs verification.

## What we learned

The useful boundary for an operational agent is not "AI versus rules." Qwen is strongest at interpreting ambiguous evidence and connecting symptoms into a plausible diagnosis. Deterministic code is strongest at protecting secrets, bounding tools, validating schemas, assigning risk, and enforcing approvals. Combining those strengths produces a more capable and more inspectable system than either layer alone.

## What's next

- Replace in-memory run state with encrypted, tenant-isolated durable storage.
- Add authenticated operator roles and signed, expiring approval requests.
- Introduce connector-specific least-privilege diagnostic adapters.
- Evaluate live Qwen performance on a larger blinded incident corpus.
- Measure diagnosis accuracy, unsupported-claim rate, tool-call efficiency, approval precision, and p95 latency.

## Built with

Qwen Cloud, Alibaba Cloud Function Compute, Serverless Devs, Node.js, HTML, CSS, JavaScript, GitHub Actions

## Required links

- Source: https://github.com/tinyopsstudio/circuitpilot-qwen-autopilot
- Live demo: `[ADD FUNCTION COMPUTE URL]`
- Architecture proof: https://github.com/tinyopsstudio/circuitpilot-qwen-autopilot/blob/main/docs/architecture.png
- Alibaba deployment proof: https://github.com/tinyopsstudio/circuitpilot-qwen-autopilot/blob/main/s.yaml
- Video: `[ADD PUBLIC VIDEO URL]`
- Build article: `[ADD PUBLIC ARTICLE URL]`

## Final verification before submit

- [ ] Live demo reports `provider: qwen-cloud` and `live: true` at `/health`.
- [ ] Function Compute URL is public and loads on desktop and mobile.
- [ ] One live Qwen scenario completes without degraded mode.
- [ ] Public repository description and homepage point to the live demo.
- [ ] Architecture image renders on GitHub.
- [ ] Video is public and under three minutes.
- [ ] Build article is public and linked for the bonus prize.
- [ ] Devpost project is entered as TinyOps Studio LLC in the Autopilot Agent track.
- [ ] Prior-work disclosure remains intact.
