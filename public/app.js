const state = {
  scenarios: [],
  selectedId: null,
  activeRun: null,
  busy: false,
};

const elements = Object.fromEntries([
  'providerStatus', 'refreshButton', 'scenarioCount', 'scenarioList', 'selectedSeverity',
  'runHeading', 'incidentMessage', 'diagnoseButton', 'workflowStrip', 'runEmpty',
  'runContent', 'diagnosisHeading', 'diagnosisRootCause', 'confidenceValue',
  'confidenceFill', 'runDuration', 'evidenceTable', 'timelineList', 'approvalSummary',
  'actionList', 'workflowStatus', 'workflowSettings', 'toast',
].map((id) => [id, document.getElementById(id)]));

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function iconRefresh() {
  if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('visible');
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => elements.toast.classList.remove('visible'), 2600);
}

async function requestJson(url, options) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
}

function selectedScenario() {
  return state.scenarios.find((scenario) => scenario.id === state.selectedId) || null;
}

function renderScenarioList() {
  elements.scenarioCount.textContent = String(state.scenarios.length);
  elements.scenarioList.innerHTML = state.scenarios.map((scenario) => `
    <button class="scenario-item ${scenario.id === state.selectedId ? 'active' : ''}" type="button" data-scenario-id="${escapeHtml(scenario.id)}">
      <span class="scenario-name">${escapeHtml(scenario.label)}</span>
      <span class="scenario-workflow">${escapeHtml(scenario.workflowName)}</span>
      <span class="scenario-meta">
        <span class="severity-dot ${escapeHtml(scenario.severity)}"></span>
        <span>${escapeHtml(scenario.severity)}</span>
        <span>${escapeHtml(money(scenario.impact?.revenueRiskUsd))} risk</span>
      </span>
    </button>
  `).join('');
}

function renderWorkflow(workflow) {
  if (!workflow?.nodes?.length) {
    elements.workflowStrip.innerHTML = '<span class="eyebrow">Workflow unavailable</span>';
    return;
  }
  elements.workflowStrip.innerHTML = workflow.nodes.map((node, index) => `
    <div class="workflow-node">
      <strong>${escapeHtml(node.id)}</strong>
      <span>${escapeHtml(node.connector || node.type)}</span>
    </div>
    ${index < workflow.nodes.length - 1 ? '<span class="workflow-arrow"><i data-lucide="arrow-right" aria-hidden="true"></i></span>' : ''}
  `).join('');
  iconRefresh();
}

function selectScenario(id) {
  state.selectedId = id;
  state.activeRun = null;
  const scenario = selectedScenario();
  renderScenarioList();
  elements.selectedSeverity.textContent = scenario ? `${scenario.severity} severity` : 'Select an incident';
  elements.runHeading.textContent = scenario?.workflowName || 'No active diagnosis';
  elements.incidentMessage.textContent = scenario?.message || 'Choose a workflow signal from the queue.';
  elements.diagnoseButton.disabled = !scenario || state.busy;
  elements.runEmpty.classList.remove('is-hidden');
  elements.runContent.classList.add('is-hidden');
  renderWorkflow(scenario ? { nodes: scenario.workflowNodes } : null);
  renderActions(null);
}

function summarizeEvidence(evidence) {
  const result = evidence?.result || {};
  if (result.status) return result.status.replaceAll('_', ' ');
  if (result.tier) return `${result.tier} blast radius`;
  if (result.failureCount !== undefined) return `${result.failureCount} failures in ${result.minutes} minutes`;
  if (result.totalRetries !== undefined) return `${result.totalRetries} retries, ${result.pressure} pressure`;
  return 'Completed';
}

function eventLabel(type) {
  return String(type || '')
    .replaceAll('_', ' ')
    .replace(/^./, (value) => value.toUpperCase());
}

function renderActions(run) {
  const actions = run?.actions || [];
  const pending = actions.filter((action) => action.status === 'pending_approval').length;
  elements.approvalSummary.innerHTML = `<span class="summary-value">${pending}</span><span class="summary-label">actions pending</span>`;

  if (!actions.length) {
    elements.actionList.innerHTML = '<div class="action-empty">No remediation plan is active.</div>';
  } else {
    elements.actionList.innerHTML = actions.map((action) => `
      <article class="action-card">
        <div class="action-card-head">
          <span class="action-risk ${escapeHtml(action.risk)}">${escapeHtml(action.risk)} risk</span>
          <h3>${escapeHtml(action.title)}</h3>
          <p>${escapeHtml(action.rationale)}</p>
        </div>
        ${action.status === 'pending_approval' ? `
          <div class="action-buttons">
            <button class="reject-button" type="button" data-decision="reject" data-action-id="${escapeHtml(action.id)}">
              <i data-lucide="x" aria-hidden="true"></i><span>Reject</span>
            </button>
            <button class="approve-button" type="button" data-decision="approve" data-action-id="${escapeHtml(action.id)}">
              <i data-lucide="check" aria-hidden="true"></i><span>Approve</span>
            </button>
          </div>
        ` : `<div class="action-status">${escapeHtml(action.status.replaceAll('_', ' '))}</div>`}
      </article>
    `).join('');
  }

  const settings = Object.keys(run?.workflowState?.settings || {});
  elements.workflowStatus.textContent = run?.workflowState?.status || '-';
  elements.workflowSettings.textContent = settings.length ? settings.join(', ') : 'unchanged';
  iconRefresh();
}

function renderRun(run) {
  state.activeRun = run;
  elements.runEmpty.classList.add('is-hidden');
  elements.runContent.classList.remove('is-hidden');
  elements.selectedSeverity.textContent = `${run.incident.severity || 'unknown'} severity | ${run.status.replaceAll('_', ' ')}`;
  elements.runHeading.textContent = run.incident.workflow.name;
  elements.incidentMessage.textContent = run.summary;
  elements.diagnosisHeading.textContent = eventLabel(run.diagnosis?.category || 'unknown');
  elements.diagnosisRootCause.textContent = run.diagnosis?.rootCause || 'No root cause was returned.';
  const confidence = Math.round((run.confidence || 0) * 100);
  elements.confidenceValue.textContent = `${confidence}%`;
  elements.confidenceFill.style.width = `${confidence}%`;
  elements.runDuration.textContent = `${run.durationMs || 0} ms | ${run.provider.live && !run.degraded ? 'Qwen Cloud' : 'degraded mode'}`;
  elements.evidenceTable.innerHTML = (run.evidence || []).map((evidence) => `
    <tr>
      <td>${escapeHtml(eventLabel(evidence.tool))}</td>
      <td>${escapeHtml(summarizeEvidence(evidence))}</td>
      <td>${escapeHtml(evidence.durationMs)} ms</td>
    </tr>
  `).join('');
  elements.timelineList.innerHTML = (run.timeline || []).map((event) => `
    <li>
      <span class="timeline-marker"></span>
      <span class="timeline-event">${escapeHtml(eventLabel(event.type))}</span>
      <span class="timeline-time">${escapeHtml(new Date(event.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))}</span>
    </li>
  `).join('');
  renderWorkflow(run.workflowState);
  renderActions(run);
}

async function diagnose() {
  if (!state.selectedId || state.busy) return;
  state.busy = true;
  elements.diagnoseButton.disabled = true;
  elements.diagnoseButton.innerHTML = '<i data-lucide="loader-circle" aria-hidden="true"></i><span>Diagnosing</span>';
  iconRefresh();
  try {
    const payload = await requestJson('/api/runs', {
      method: 'POST',
      body: JSON.stringify({ scenarioId: state.selectedId }),
    });
    renderRun(payload.run);
  } catch (error) {
    showToast(error.message);
  } finally {
    state.busy = false;
    elements.diagnoseButton.disabled = false;
    elements.diagnoseButton.innerHTML = '<i data-lucide="activity" aria-hidden="true"></i><span>Diagnose incident</span>';
    iconRefresh();
  }
}

async function decide(actionId, decision) {
  if (!state.activeRun || state.busy) return;
  state.busy = true;
  try {
    const payload = await requestJson(`/api/runs/${encodeURIComponent(state.activeRun.id)}/actions/${encodeURIComponent(actionId)}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, actor: 'demo_operator' }),
    });
    renderRun(payload.run);
    showToast(decision === 'approve' ? 'Sandbox action approved.' : 'Action rejected.');
  } catch (error) {
    showToast(error.message);
  } finally {
    state.busy = false;
  }
}

async function refreshRun() {
  if (!state.activeRun) return;
  try {
    const payload = await requestJson(`/api/runs/${encodeURIComponent(state.activeRun.id)}`);
    renderRun(payload.run);
  } catch (error) {
    showToast(error.message);
  }
}

elements.scenarioList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-scenario-id]');
  if (button) selectScenario(button.dataset.scenarioId);
});
elements.actionList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action-id]');
  if (button) decide(button.dataset.actionId, button.dataset.decision);
});
elements.diagnoseButton.addEventListener('click', diagnose);
elements.refreshButton.addEventListener('click', refreshRun);

async function initialize() {
  try {
    const [scenarioPayload, meta] = await Promise.all([
      requestJson('/api/scenarios'),
      requestJson('/api/meta'),
    ]);
    state.scenarios = scenarioPayload.scenarios;
    elements.providerStatus.classList.toggle('live', Boolean(meta.live));
    elements.providerStatus.innerHTML = `<span class="status-dot"></span>${escapeHtml(meta.live ? `${meta.model} live` : 'Local safety mode')}`;
    selectScenario(state.scenarios[0]?.id || null);
  } catch (error) {
    showToast(error.message);
  }
  iconRefresh();
}

initialize();
