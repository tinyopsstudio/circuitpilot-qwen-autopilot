import { performance } from 'node:perf_hooks';
import { DIAGNOSTIC_CATALOG } from './catalog.js';
import { sanitize } from './security.js';

function graphInspection(workflow) {
  const nodes = workflow.nodes || [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const invalidEdges = [];

  for (const node of nodes) {
    for (const target of node.next || []) {
      if (!nodeIds.has(target)) invalidEdges.push({ from: node.id, to: target });
      else incoming.set(target, (incoming.get(target) || 0) + 1);
    }
  }

  const disconnected = nodes
    .filter((node, index) => index > 0 && incoming.get(node.id) === 0)
    .map((node) => node.id);

  return {
    workflowId: workflow.id,
    nodeCount: nodes.length,
    edgeCount: nodes.reduce((sum, node) => sum + (node.next?.length || 0), 0),
    invalidEdges,
    disconnected,
    status: invalidEdges.length || disconnected.length ? 'issues_found' : 'valid',
  };
}

function contractInspection(workflow, signal) {
  const required = workflow.contract?.required || [];
  const payload = signal.samplePayload || {};
  const missing = required.filter((field) => !(field in payload));
  const unexpected = Object.keys(payload).filter((field) => !required.includes(field));
  return { required, present: Object.keys(payload), missing, unexpected, status: missing.length ? 'mismatch' : 'valid' };
}

export class DiagnosticRuntime {
  constructor(incident) {
    this.incident = incident;
  }

  async run(name, args = {}) {
    if (!DIAGNOSTIC_CATALOG[name]) throw new Error(`unsupported_diagnostic:${name}`);
    const started = performance.now();
    let result;

    if (name === 'inspect_workflow_graph') {
      result = graphInspection(this.incident.workflow);
    } else if (name === 'check_connector_health') {
      const connector = String(args.connector || '');
      const snapshot = this.incident.workflow.connectors?.[connector];
      result = snapshot
        ? { connector, ...snapshot }
        : { connector, status: 'not_in_workflow', allowed: Object.keys(this.incident.workflow.connectors || {}) };
    } else if (name === 'search_failure_window') {
      const minutes = Math.min(240, Math.max(5, Number(args.minutes) || 60));
      const failures = (this.incident.signal.logs || []).filter((entry) => entry.minutesAgo <= minutes);
      result = {
        minutes,
        failureCount: failures.length,
        codes: [...new Set(failures.map((entry) => entry.code))],
        nodes: [...new Set(failures.map((entry) => entry.node))],
        failures,
      };
    } else if (name === 'inspect_payload_contract') {
      result = contractInspection(this.incident.workflow, this.incident.signal);
    } else if (name === 'calculate_retry_pressure') {
      const logs = this.incident.signal.logs || [];
      const totalRetries = logs.reduce((sum, entry) => sum + (Number(entry.retryCount) || 0), 0);
      result = {
        totalRetries,
        maxRetryCount: Math.max(0, ...logs.map((entry) => Number(entry.retryCount) || 0)),
        queuedRecords: this.incident.signal.impact?.queuedRecords || 0,
        pressure: totalRetries >= 10 ? 'high' : totalRetries >= 4 ? 'elevated' : 'normal',
      };
    } else if (name === 'estimate_blast_radius') {
      const impact = this.incident.signal.impact || {};
      result = {
        affectedRecords: impact.affectedRecords || 0,
        queuedRecords: impact.queuedRecords || 0,
        systems: impact.systems || [],
        revenueRiskUsd: impact.revenueRiskUsd || 0,
        tier: (impact.revenueRiskUsd || 0) >= 5000 ? 'high' : (impact.affectedRecords || 0) >= 10 ? 'medium' : 'contained',
      };
    }

    return {
      tool: name,
      durationMs: Math.max(1, Math.round(performance.now() - started)),
      result: sanitize(result),
    };
  }
}
