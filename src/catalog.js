export const DIAGNOSTIC_CATALOG = Object.freeze({
  inspect_workflow_graph: {
    description: 'Inspect nodes and edges for disconnected, cyclic, or invalid paths.',
  },
  check_connector_health: {
    description: 'Read the health snapshot for one connector already present in the workflow.',
  },
  search_failure_window: {
    description: 'Summarize bounded, recent workflow failures from the supplied incident window.',
  },
  inspect_payload_contract: {
    description: 'Compare a redacted sample payload with the workflow input contract.',
  },
  calculate_retry_pressure: {
    description: 'Calculate retry volume and rate-limit pressure from supplied execution logs.',
  },
  estimate_blast_radius: {
    description: 'Estimate affected records, systems, and business impact from supplied evidence.',
  },
});

export const ACTION_CATALOG = Object.freeze({
  pause_workflow: {
    risk: 'high',
    approval: true,
    execution: 'sandbox',
    description: 'Pause new workflow executions while preserving queued work.',
  },
  apply_retry_policy: {
    risk: 'medium',
    approval: true,
    execution: 'sandbox',
    description: 'Stage capped exponential backoff and retry limits.',
  },
  update_field_mapping: {
    risk: 'medium',
    approval: true,
    execution: 'sandbox',
    description: 'Stage a field-mapping patch in the isolated workflow copy.',
  },
  add_idempotency_guard: {
    risk: 'medium',
    approval: true,
    execution: 'sandbox',
    description: 'Stage a deterministic duplicate-event guard.',
  },
  replay_failed_items: {
    risk: 'high',
    approval: true,
    execution: 'sandbox',
    description: 'Replay a bounded batch of failed items in the isolated workflow copy.',
  },
  rotate_connector_credential: {
    risk: 'high',
    approval: true,
    execution: 'manual',
    description: 'Create a credential-rotation handoff without handling credential material.',
  },
  create_operator_note: {
    risk: 'low',
    approval: false,
    execution: 'sandbox',
    description: 'Append a non-sensitive note to the incident audit trail.',
  },
  no_action: {
    risk: 'low',
    approval: false,
    execution: 'none',
    description: 'Record that no state-changing remediation is warranted.',
  },
});

export const DIAGNOSTIC_TOOL_DEFINITIONS = Object.freeze([
  {
    type: 'function',
    function: {
      name: 'check_connector_health',
      description: DIAGNOSTIC_CATALOG.check_connector_health.description,
      parameters: {
        type: 'object',
        properties: {
          connector: {
            type: 'string',
            description: 'Connector name exactly as shown in the redacted workflow context.',
          },
        },
        required: ['connector'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_failure_window',
      description: DIAGNOSTIC_CATALOG.search_failure_window.description,
      parameters: {
        type: 'object',
        properties: {
          minutes: { type: 'integer', minimum: 5, maximum: 240 },
        },
        required: ['minutes'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'inspect_payload_contract',
      description: DIAGNOSTIC_CATALOG.inspect_payload_contract.description,
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_retry_pressure',
      description: DIAGNOSTIC_CATALOG.calculate_retry_pressure.description,
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
]);
