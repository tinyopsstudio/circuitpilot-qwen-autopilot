const SCENARIOS = [
  {
    id: 'expired-crm-token',
    label: 'CRM authentication failure',
    severity: 'high',
    workflow: {
      id: 'wf-lead-routing',
      name: 'Inbound lead routing',
      version: 17,
      status: 'active',
      nodes: [
        { id: 'webhook', type: 'trigger', next: ['normalize'] },
        { id: 'normalize', type: 'transform', next: ['crm'] },
        { id: 'crm', type: 'connector', connector: 'Northstar CRM', next: ['notify'] },
        { id: 'notify', type: 'connector', connector: 'Team Chat', next: [] },
      ],
      connectors: {
        'Northstar CRM': { status: 'unauthorized', latencyMs: 184, checkedAt: '2026-07-16T14:10:00Z' },
        'Team Chat': { status: 'healthy', latencyMs: 91, checkedAt: '2026-07-16T14:10:00Z' },
      },
      contract: { required: ['lead_id', 'email', 'source'] },
    },
    signal: {
      kind: 'authentication',
      source: 'workflow-monitor',
      message: 'Northstar CRM returned HTTP 401 on 18 consecutive lead upserts.',
      samplePayload: { lead_id: 'lead_demo_1042', email: 'buyer@example.test', source: 'website' },
      impact: { affectedRecords: 18, queuedRecords: 42, systems: ['Northstar CRM'], revenueRiskUsd: 3600 },
      logs: [
        { minutesAgo: 3, node: 'crm', code: 401, retryCount: 3, message: 'access token expired' },
        { minutesAgo: 8, node: 'crm', code: 401, retryCount: 3, message: 'access token expired' },
        { minutesAgo: 14, node: 'crm', code: 401, retryCount: 2, message: 'authentication failed' },
      ],
    },
  },
  {
    id: 'payload-contract-drift',
    label: 'Webhook contract drift',
    severity: 'medium',
    workflow: {
      id: 'wf-order-fulfillment',
      name: 'Order fulfillment handoff',
      version: 31,
      status: 'active',
      nodes: [
        { id: 'order-webhook', type: 'trigger', next: ['validate'] },
        { id: 'validate', type: 'transform', next: ['warehouse'] },
        { id: 'warehouse', type: 'connector', connector: 'Warehouse API', next: [] },
      ],
      connectors: {
        'Warehouse API': { status: 'healthy', latencyMs: 137, checkedAt: '2026-07-16T14:05:00Z' },
      },
      contract: { required: ['order_id', 'customer_email', 'shipping_address'] },
    },
    signal: {
      kind: 'payload_contract',
      source: 'dead-letter-queue',
      message: 'New checkout payloads use shippingAddress instead of shipping_address.',
      samplePayload: {
        order_id: 'order_demo_882',
        customer_email: 'customer@example.test',
        shippingAddress: { country: 'US', postal_code: '10001' },
      },
      impact: { affectedRecords: 9, queuedRecords: 9, systems: ['Warehouse API'], revenueRiskUsd: 1125 },
      logs: [
        { minutesAgo: 2, node: 'validate', code: 422, retryCount: 0, message: 'shipping_address is required' },
        { minutesAgo: 6, node: 'validate', code: 422, retryCount: 0, message: 'shipping_address is required' },
      ],
    },
  },
  {
    id: 'rate-limit-surge',
    label: 'Vendor rate-limit surge',
    severity: 'medium',
    workflow: {
      id: 'wf-invoice-sync',
      name: 'Invoice reconciliation sync',
      version: 9,
      status: 'active',
      nodes: [
        { id: 'schedule', type: 'trigger', next: ['accounting'] },
        { id: 'accounting', type: 'connector', connector: 'Ledger API', next: ['reconcile'] },
        { id: 'reconcile', type: 'transform', next: [] },
      ],
      connectors: {
        'Ledger API': { status: 'rate_limited', latencyMs: 1600, checkedAt: '2026-07-16T14:08:00Z' },
      },
      contract: { required: ['invoice_id', 'amount', 'currency'] },
    },
    signal: {
      kind: 'rate_limit',
      source: 'latency-slo',
      message: 'Ledger API is returning HTTP 429 after a batch-size increase.',
      samplePayload: { invoice_id: 'inv_demo_511', amount: 149, currency: 'USD' },
      impact: { affectedRecords: 73, queuedRecords: 218, systems: ['Ledger API'], revenueRiskUsd: 7300 },
      logs: [
        { minutesAgo: 1, node: 'accounting', code: 429, retryCount: 6, message: 'rate limit exceeded' },
        { minutesAgo: 4, node: 'accounting', code: 429, retryCount: 5, message: 'retry-after: 30' },
        { minutesAgo: 9, node: 'accounting', code: 429, retryCount: 4, message: 'rate limit exceeded' },
      ],
    },
  },
  {
    id: 'duplicate-payment-events',
    label: 'Duplicate payment events',
    severity: 'critical',
    workflow: {
      id: 'wf-payment-posting',
      name: 'Payment posting',
      version: 22,
      status: 'active',
      nodes: [
        { id: 'payment-webhook', type: 'trigger', next: ['post-payment'] },
        { id: 'post-payment', type: 'connector', connector: 'Billing Ledger', next: ['receipt'] },
        { id: 'receipt', type: 'connector', connector: 'Email Service', next: [] },
      ],
      connectors: {
        'Billing Ledger': { status: 'healthy', latencyMs: 201, checkedAt: '2026-07-16T14:12:00Z' },
        'Email Service': { status: 'healthy', latencyMs: 83, checkedAt: '2026-07-16T14:12:00Z' },
      },
      contract: { required: ['event_id', 'payment_id', 'amount'] },
    },
    signal: {
      kind: 'duplicate_event',
      source: 'reconciliation-check',
      message: 'The same payment event ID was accepted twice after a webhook retry.',
      samplePayload: { event_id: 'evt_demo_229', payment_id: 'pay_demo_744', amount: 499 },
      impact: { affectedRecords: 2, queuedRecords: 11, systems: ['Billing Ledger'], revenueRiskUsd: 998 },
      logs: [
        { minutesAgo: 2, node: 'post-payment', code: 200, retryCount: 1, message: 'event evt_demo_229 accepted' },
        { minutesAgo: 3, node: 'post-payment', code: 200, retryCount: 0, message: 'event evt_demo_229 accepted' },
      ],
    },
  },
];

function clone(value) {
  return structuredClone(value);
}

export function listScenarios() {
  return SCENARIOS.map(({ workflow, signal, ...scenario }) => ({
    ...scenario,
    workflowName: workflow.name,
    workflowNodes: clone(workflow.nodes),
    message: signal.message,
    impact: clone(signal.impact),
  }));
}

export function getScenario(id) {
  const scenario = SCENARIOS.find((candidate) => candidate.id === id);
  return scenario ? clone(scenario) : null;
}
