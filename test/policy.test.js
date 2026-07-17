import test from 'node:test';
import assert from 'node:assert/strict';
import { applySandboxAction, evaluateActions } from '../src/policy.js';

test('requires approval for every consequential catalog action', () => {
  const actions = evaluateActions('run_test', [
    { type: 'pause_workflow', title: 'Pause it' },
    { type: 'apply_retry_policy', title: 'Back off' },
    { type: 'add_idempotency_guard', title: 'Dedupe it' },
  ]);
  assert.equal(actions.length, 3);
  assert.ok(actions.every((action) => action.status === 'pending_approval'));
  assert.ok(actions.every((action) => action.requiresApproval));
});

test('blocks an action type invented by model output', () => {
  const [action] = evaluateActions('run_test', [{ type: 'run_shell_command', title: 'Do anything' }]);
  assert.equal(action.status, 'blocked');
  assert.equal(action.risk, 'unknown');
});

test('applies approved changes only to an isolated workflow copy', () => {
  const original = { id: 'wf_1', status: 'active', settings: {} };
  const [action] = evaluateActions('run_test', [{
    type: 'apply_retry_policy',
    parameters: { maxAttempts: 99, baseDelaySeconds: 30 },
  }]);
  const applied = applySandboxAction(action, original);
  assert.equal(original.settings.retryPolicy, undefined);
  assert.equal(applied.state.settings.retryPolicy.maxAttempts, 8);
  assert.equal(applied.result.status, 'applied_to_sandbox');
});
