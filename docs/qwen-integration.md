# Qwen Cloud integration

CircuitPilot uses the Qwen Cloud OpenAI-compatible Chat Completions endpoint:

```text
https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions
```

The default model is `qwen3.7-plus`.

## Agent loop

1. CircuitPilot runs two mandatory local checks: workflow graph integrity and blast radius.
2. It sends a redacted incident and verified baseline evidence to Qwen.
3. Qwen may select one additional read-only diagnostic at a time through function calling.
4. CircuitPilot validates and executes the selected tool locally, then returns its bounded result as a tool message.
5. The loop stops after four tool-call turns or when Qwen has enough evidence.
6. CircuitPilot asks Qwen for a JSON remediation plan using `response_format: {"type":"json_object"}`.
7. The independent policy engine assigns risk, blocks unknown actions, and enforces approval.

`parallel_tool_calls` is disabled so each diagnostic has a visible causal position in the audit timeline. The model temperature is `0.1` to favor repeatable operational output.

## Prompt-injection boundary

The system prompt explicitly treats incident text and tool results as untrusted data. More importantly, the enforcement boundary is outside the prompt: Qwen can name only a proposed action, while deterministic code decides whether that name is recognized, whether approval is required, and what the sandbox executor may do.

## Offline mode

When `DASHSCOPE_API_KEY` is absent, a deterministic fixture planner exercises the same tools, policy, approval, audit, API, and UI paths. This mode is labeled `Local safety mode`; it is intended for repeatable tests and does not claim live Qwen usage.
