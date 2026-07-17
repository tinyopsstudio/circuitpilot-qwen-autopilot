import { sanitize } from './security.js';

export class MemoryRunStore {
  constructor({ maxRuns = 100 } = {}) {
    this.maxRuns = maxRuns;
    this.runs = new Map();
  }

  put(run) {
    if (!this.runs.has(run.id) && this.runs.size >= this.maxRuns) {
      const oldest = this.runs.keys().next().value;
      this.runs.delete(oldest);
    }
    this.runs.set(run.id, structuredClone(run));
    return this.get(run.id);
  }

  get(id) {
    const run = this.runs.get(id);
    return run ? structuredClone(run) : null;
  }

  list() {
    return [...this.runs.values()]
      .map((run) => structuredClone(run))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export function emitAudit(event) {
  const safeEvent = sanitize({
    service: 'circuitpilot',
    eventVersion: 1,
    ...event,
  });
  console.log(JSON.stringify(safeEvent));
}
