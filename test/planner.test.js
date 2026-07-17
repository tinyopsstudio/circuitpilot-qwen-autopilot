import test from 'node:test';
import assert from 'node:assert/strict';
import { QwenPlanner } from '../src/planner.js';
import { getScenario } from '../src/scenarios.js';

test('executes a Qwen-selected tool and validates the final JSON plan', async () => {
  const responses = [
    {
      choices: [{ message: { role: 'assistant', content: '', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'inspect_payload_contract', arguments: '{}' } }] } }],
      usage: { total_tokens: 50 },
    },
    { choices: [{ message: { role: 'assistant', content: 'Evidence is sufficient.' } }], usage: { total_tokens: 30 } },
    {
      choices: [{ message: { role: 'assistant', content: JSON.stringify({
        summary: 'Payload drift confirmed.',
        confidence: 0.91,
        diagnosis: { category: 'payload_contract_drift', rootCause: 'Field renamed.', evidence: ['contract mismatch'] },
        actions: [{ type: 'update_field_mapping', title: 'Stage mapping', parameters: { from: 'shippingAddress', to: 'shipping_address' } }],
      }) } }],
      usage: { total_tokens: 80 },
    },
  ];
  const requestBodies = [];
  const planner = new QwenPlanner({
    apiKey: 'test-key-not-real',
    fetchImpl: async (_url, options) => {
      requestBodies.push(JSON.parse(options.body));
      return { ok: true, json: async () => responses.shift() };
    },
  });
  const tools = [];
  const plan = await planner.diagnose(getScenario('payload-contract-drift'), [], async (name) => {
    tools.push(name);
    return { tool: name, durationMs: 1, result: { status: 'mismatch' } };
  });
  assert.deepEqual(tools, ['inspect_payload_contract']);
  assert.equal(plan.diagnosis.category, 'payload_contract_drift');
  assert.equal(plan.actions[0].type, 'update_field_mapping');
  assert.equal(requestBodies.at(-1).response_format.type, 'json_object');
});
