import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { applySandboxAction, evaluateActions } from './policy.js';
import { DeterministicFallbackPlanner } from './planner.js';
import { getScenario } from './scenarios.js';
import { sanitize } from './security.js';
import { emitAudit, MemoryRunStore } from './store.js';
import { DiagnosticRuntime } from './tools.js';

function now() {
  return new Date().toISOString();
}

function addEvent(run, type, detail = {}) {
  run.timeline.push({
    id: `evt_${run.timeline.length + 1}`,
    at: now(),
    type,
    ...sanitize(detail),
  });
}

function validateIncident(incident) {
  if (!incident?.workflow?.id || !incident?.signal?.kind) throw new Error('invalid_incident');
  if (!Array.isArray(incident.workflow.nodes) || incident.workflow.nodes.length === 0) {
    throw new Error('workflow_nodes_required');
  }
  return sanitize(incident);
}

export class CircuitPilotAgent {
  constructor({ planner, store = new MemoryRunStore() }) {
    this.planner = planner;
    this.store = store;
  }

  meta() {
    return {
      provider: this.planner.provider,
      model: this.planner.model,
      live: this.planner.live,
      approvalPolicy: 'all_consequential_actions',
      executionTarget: 'isolated_sandbox',
    };
  }

  async startRun({ scenarioId, incident } = {}) {
    const scenario = scenarioId ? getScenario(scenarioId) : null;
    const acceptedIncident = validateIncident(incident || scenario);
    const run = {
      id: `run_${randomUUID().slice(0, 8)}`,
      scenarioId: scenarioId || 'custom',
      createdAt: now(),
      updatedAt: now(),
      status: 'diagnosing',
      degraded: false,
      provider: this.meta(),
      incident: acceptedIncident,
      workflowState: structuredClone(acceptedIncident.workflow),
      timeline: [],
      evidence: [],
      actions: [],
    };
    addEvent(run, 'incident_accepted', { severity: acceptedIncident.severity, workflowId: acceptedIncident.workflow.id });
    this.store.put(run);
    emitAudit({ runId: run.id, type: 'incident_accepted', workflowId: acceptedIncident.workflow.id });

    const tools = new DiagnosticRuntime(acceptedIncident);
    const started = performance.now();
    const baselineEvidence = [
      await tools.run('inspect_workflow_graph'),
      await tools.run('estimate_blast_radius'),
    ];
    run.evidence.push(...baselineEvidence);
    addEvent(run, 'baseline_diagnostics_completed', { tools: baselineEvidence.map((item) => item.tool) });

    let plan;
    try {
      plan = await this.planner.diagnose(
        acceptedIncident,
        baselineEvidence,
        async (name, args) => {
          const result = await tools.run(name, args);
          addEvent(run, 'diagnostic_completed', { tool: name, durationMs: result.durationMs });
          return result;
        },
      );
    } catch (error) {
      if (!this.planner.live) throw error;
      run.degraded = true;
      addEvent(run, 'qwen_fallback_activated', { reason: error.message });
      const fallback = new DeterministicFallbackPlanner();
      plan = await fallback.diagnose(acceptedIncident, baselineEvidence, (name, args) => tools.run(name, args));
    }

    run.summary = plan.summary;
    run.confidence = plan.confidence;
    run.diagnosis = plan.diagnosis;
    run.evidence = plan.evidence;
    run.usage = plan.usage;
    run.actions = evaluateActions(run.id, plan.actions);

    for (const action of run.actions.filter((candidate) => candidate.status === 'ready')) {
      const applied = applySandboxAction(action, run.workflowState);
      run.workflowState = applied.state;
      action.status = 'executed';
      action.result = applied.result;
      action.decidedAt = now();
      action.decision = 'auto';
      addEvent(run, 'bounded_action_executed', { actionId: action.id, actionType: action.type });
    }

    run.status = run.actions.some((action) => action.status === 'pending_approval')
      ? 'awaiting_approval'
      : 'completed';
    run.durationMs = Math.round(performance.now() - started);
    run.updatedAt = now();
    addEvent(run, 'plan_ready', {
      confidence: run.confidence,
      actionCount: run.actions.length,
      pendingApprovals: run.actions.filter((action) => action.status === 'pending_approval').length,
    });
    this.store.put(run);
    emitAudit({ runId: run.id, type: 'plan_ready', status: run.status, durationMs: run.durationMs, degraded: run.degraded });
    return this.store.get(run.id);
  }

  getRun(id) {
    return this.store.get(id);
  }

  listRuns() {
    return this.store.list();
  }

  decide(runId, actionId, decision, actor = 'operator') {
    const run = this.store.get(runId);
    if (!run) throw new Error('run_not_found');
    const action = run.actions.find((candidate) => candidate.id === actionId);
    if (!action) throw new Error('action_not_found');
    if (action.status !== 'pending_approval') throw new Error('action_not_pending');
    if (!['approve', 'reject'].includes(decision)) throw new Error('invalid_decision');

    action.decision = decision;
    action.decidedAt = now();
    action.decidedBy = String(actor).slice(0, 80);

    if (decision === 'approve') {
      const applied = applySandboxAction(action, run.workflowState);
      run.workflowState = applied.state;
      action.status = applied.result.status === 'manual_handoff_created' ? 'manual_required' : 'executed';
      action.result = applied.result;
    } else {
      action.status = 'rejected';
      action.result = { status: 'not_executed' };
    }

    addEvent(run, 'operator_decision_recorded', {
      actionId: action.id,
      actionType: action.type,
      decision,
      result: action.result.status,
    });
    const pending = run.actions.filter((candidate) => candidate.status === 'pending_approval').length;
    run.status = pending ? 'awaiting_approval' : 'completed';
    run.updatedAt = now();
    this.store.put(run);
    emitAudit({ runId, type: 'operator_decision_recorded', actionId, decision, status: run.status });
    return this.store.get(runId);
  }
}
