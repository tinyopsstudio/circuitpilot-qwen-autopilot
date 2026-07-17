import test from 'node:test';
import assert from 'node:assert/strict';
import { CircuitPilotAgent } from '../src/agent.js';
import { DeterministicFallbackPlanner } from '../src/planner.js';
import { createCircuitPilotServer } from '../src/server.js';

async function withServer(callback) {
  const agent = new CircuitPilotAgent({ planner: new DeterministicFallbackPlanner() });
  const server = createCircuitPilotServer({ agent });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('serves health, scenarios, and the operator application', async () => {
  await withServer(async (baseUrl) => {
    const health = await fetch(`${baseUrl}/health`).then((response) => response.json());
    assert.equal(health.status, 'ok');
    const scenarios = await fetch(`${baseUrl}/api/scenarios`).then((response) => response.json());
    assert.equal(scenarios.scenarios.length, 4);
    const app = await fetch(baseUrl);
    assert.equal(app.status, 200);
    assert.match(await app.text(), /CircuitPilot/);
    assert.equal(app.headers.get('x-frame-options'), 'DENY');
  });
});

test('runs an incident and accepts an explicit approval through the API', async () => {
  await withServer(async (baseUrl) => {
    const createdResponse = await fetch(`${baseUrl}/api/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId: 'rate-limit-surge' }),
    });
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()).run;
    const [action] = created.actions;
    const decisionResponse = await fetch(`${baseUrl}/api/runs/${created.id}/actions/${action.id}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'approve' }),
    });
    assert.equal(decisionResponse.status, 200);
    const updated = (await decisionResponse.json()).run;
    assert.equal(updated.status, 'completed');
    assert.equal(updated.workflowState.settings.retryPolicy.strategy, 'exponential');
  });
});
