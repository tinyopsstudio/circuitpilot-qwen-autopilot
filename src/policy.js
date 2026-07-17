import { createHash } from 'node:crypto';
import { ACTION_CATALOG } from './catalog.js';
import { sanitize } from './security.js';

function actionId(runId, action, index) {
  return `act_${createHash('sha256')
    .update(`${runId}:${index}:${action.type}:${action.title || ''}`)
    .digest('hex')
    .slice(0, 10)}`;
}

export function evaluateActions(runId, proposedActions = []) {
  const seen = new Set();
  const evaluated = [];

  for (const [index, rawAction] of proposedActions.slice(0, 5).entries()) {
    const action = sanitize(rawAction);
    const policy = ACTION_CATALOG[action.type];
    if (!policy) {
      evaluated.push({
        id: actionId(runId, action, index),
        ...action,
        status: 'blocked',
        risk: 'unknown',
        policyReason: 'Action type is not in the bounded execution catalog.',
      });
      continue;
    }
    if (seen.has(action.type)) continue;
    seen.add(action.type);

    evaluated.push({
      id: actionId(runId, action, index),
      type: action.type,
      title: String(action.title || policy.description).slice(0, 120),
      rationale: String(action.rationale || '').slice(0, 800),
      parameters: sanitize(action.parameters || {}),
      expectedOutcome: String(action.expectedOutcome || '').slice(0, 500),
      rollback: String(action.rollback || 'Revert the staged sandbox change.').slice(0, 500),
      risk: policy.risk,
      execution: policy.execution,
      requiresApproval: policy.approval,
      status: policy.approval ? 'pending_approval' : 'ready',
      policyReason: policy.approval
        ? 'State-changing and manual actions require an explicit operator decision.'
        : 'This action is non-consequential and bounded to the incident record.',
    });
  }

  return evaluated.length
    ? evaluated
    : evaluateActions(runId, [{ type: 'no_action', title: 'No remediation proposed' }]);
}

export function applySandboxAction(action, workflowState) {
  const next = structuredClone(workflowState);
  next.settings ||= {};
  next.auditNotes ||= [];

  if (action.execution === 'manual') {
    return {
      state: next,
      result: {
        status: 'manual_handoff_created',
        message: 'Credential material is never handled by the demo executor.',
      },
    };
  }

  if (action.type === 'pause_workflow') {
    next.status = 'paused';
  } else if (action.type === 'apply_retry_policy') {
    next.settings.retryPolicy = {
      strategy: 'exponential',
      maxAttempts: Math.min(8, Math.max(1, Number(action.parameters?.maxAttempts) || 4)),
      baseDelaySeconds: Math.min(120, Math.max(1, Number(action.parameters?.baseDelaySeconds) || 10)),
      jitter: true,
    };
  } else if (action.type === 'update_field_mapping') {
    next.settings.fieldMappings ||= {};
    const from = String(action.parameters?.from || 'shippingAddress').slice(0, 80);
    const to = String(action.parameters?.to || 'shipping_address').slice(0, 80);
    next.settings.fieldMappings[from] = to;
  } else if (action.type === 'add_idempotency_guard') {
    next.settings.idempotency = {
      enabled: true,
      keyField: String(action.parameters?.keyField || 'event_id').slice(0, 80),
      ttlHours: Math.min(168, Math.max(1, Number(action.parameters?.ttlHours) || 24)),
    };
  } else if (action.type === 'replay_failed_items') {
    next.settings.lastReplay = {
      requested: Math.min(100, Math.max(1, Number(action.parameters?.limit) || 10)),
      mode: 'sandbox',
    };
  } else if (action.type === 'create_operator_note') {
    next.auditNotes.push(String(action.parameters?.note || action.rationale || 'Operator note').slice(0, 500));
  }

  return {
    state: next,
    result: {
      status: action.execution === 'none' ? 'recorded' : 'applied_to_sandbox',
      workflowStatus: next.status,
      changedSettings: Object.keys(next.settings),
    },
  };
}
