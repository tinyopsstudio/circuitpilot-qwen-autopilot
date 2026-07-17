import test from 'node:test';
import assert from 'node:assert/strict';
import { CircuitPilotAgent } from '../src/agent.js';
import { DeterministicFallbackPlanner } from '../src/planner.js';

test('diagnoses a fixture, runs bounded tools, and stops at approval', async () => {
  const agent = new CircuitPilotAgent({ planner: new DeterministicFallbackPlanner() });
  const run = await agent.startRun({ scenarioId: 'duplicate-payment-events' });
  assert.equal(run.status, 'awaiting_approval');
  assert.equal(run.diagnosis.category, 'missing_idempotency');
  assert.ok(run.evidence.some((item) => item.tool === 'inspect_workflow_graph'));
  assert.ok(run.evidence.some((item) => item.tool === 'estimate_blast_radius'));
  assert.ok(run.actions.every((action) => action.status === 'pending_approval'));
  assert.equal(run.workflowState.status, 'active');
});

test('records approval and mutates only the run sandbox', async () => {
  const agent = new CircuitPilotAgent({ planner: new DeterministicFallbackPlanner() });
  const run = await agent.startRun({ scenarioId: 'payload-contract-drift' });
  const mapping = run.actions.find((action) => action.type === 'update_field_mapping');
  const updated = agent.decide(run.id, mapping.id, 'approve', 'test_operator');
  assert.equal(updated.workflowState.settings.fieldMappings.shippingAddress, 'shipping_address');
  assert.equal(updated.actions.find((action) => action.id === mapping.id).status, 'executed');
  assert.equal(run.workflowState.settings, undefined);
});

test('rejects repeated or invalid decisions', async () => {
  const agent = new CircuitPilotAgent({ planner: new DeterministicFallbackPlanner() });
  const run = await agent.startRun({ scenarioId: 'rate-limit-surge' });
  const [action] = run.actions;
  agent.decide(run.id, action.id, 'reject');
  assert.throws(() => agent.decide(run.id, action.id, 'approve'), /action_not_pending/);
});
