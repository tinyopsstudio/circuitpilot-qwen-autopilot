import { performance } from 'node:perf_hooks';
import { CircuitPilotAgent } from '../src/agent.js';
import { createPlannerFromEnv } from '../src/planner.js';

const CASES = [
  { scenarioId: 'expired-crm-token', category: 'connector_authentication', action: 'rotate_connector_credential' },
  { scenarioId: 'payload-contract-drift', category: 'payload_contract_drift', action: 'update_field_mapping' },
  { scenarioId: 'rate-limit-surge', category: 'retry_amplification', action: 'apply_retry_policy' },
  { scenarioId: 'duplicate-payment-events', category: 'missing_idempotency', action: 'add_idempotency_guard' },
];

function totalTokens(rows = []) {
  return rows.reduce((total, row) => {
    if (!row || typeof row !== 'object') return total;
    const explicit = Number(row.total_tokens ?? row.totalTokens);
    if (Number.isFinite(explicit)) return total + explicit;
    const input = Number(row.prompt_tokens ?? row.input_tokens ?? row.inputTokens ?? 0);
    const output = Number(row.completion_tokens ?? row.output_tokens ?? row.outputTokens ?? 0);
    return total + (Number.isFinite(input) ? input : 0) + (Number.isFinite(output) ? output : 0);
  }, 0);
}

const planner = createPlannerFromEnv();
if (!planner.live || planner.provider !== 'qwen-cloud') {
  console.error(JSON.stringify({
    status: 'blocked',
    decision: 'live_qwen_credentials_required',
    requiredEnvironment: ['DASHSCOPE_API_KEY'],
  }, null, 2));
  process.exit(2);
}

const agent = new CircuitPilotAgent({ planner });
const started = performance.now();
const cases = [];

for (const evaluationCase of CASES) {
  const caseStarted = performance.now();
  const run = await agent.startRun({ scenarioId: evaluationCase.scenarioId });
  const diagnosticTools = run.timeline
    .filter((event) => event.type === 'diagnostic_completed')
    .map((event) => event.tool);
  const approvalActions = run.actions.filter((action) => ['medium', 'high'].includes(action.risk));
  const serialized = JSON.stringify(run);
  const checks = {
    liveQwen: run.provider.live === true && run.provider.provider === 'qwen-cloud' && run.degraded === false,
    category: run.diagnosis.category === evaluationCase.category,
    additionalDiagnostic: diagnosticTools.length >= 1,
    expectedAction: run.actions.some((action) => action.type === evaluationCase.action),
    approvalCoverage: approvalActions.length >= 1
      && approvalActions.every((action) => action.requiresApproval && action.status === 'pending_approval'),
    redaction: !serialized.includes('@example.test'),
  };
  cases.push({
    scenarioId: evaluationCase.scenarioId,
    expectedCategory: evaluationCase.category,
    observedCategory: run.diagnosis.category,
    expectedAction: evaluationCase.action,
    observedActions: run.actions.map((action) => action.type),
    diagnosticTools,
    pendingApprovals: run.actions.filter((action) => action.status === 'pending_approval').length,
    confidence: run.confidence,
    totalTokens: totalTokens(run.usage),
    durationMs: Math.round(performance.now() - caseStarted),
    checks,
  });
}

const assertions = cases.flatMap((item) => Object.values(item.checks));
const passed = assertions.filter(Boolean).length;
const report = {
  generatedAt: new Date().toISOString(),
  suite: 'circuitpilot-live-qwen-evaluation',
  provider: planner.provider,
  model: planner.model,
  cases,
  score: {
    passed,
    total: assertions.length,
    percent: Math.round((passed / assertions.length) * 100),
  },
  durationMs: Math.round(performance.now() - started),
  rawPrivateValuesOutput: false,
};

console.log(JSON.stringify(report, null, 2));
if (process.argv.includes('--assert') && passed !== assertions.length) process.exitCode = 1;
