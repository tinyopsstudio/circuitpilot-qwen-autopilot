import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CircuitPilotAgent } from './agent.js';
import { createPlannerFromEnv } from './planner.js';
import { listScenarios } from './scenarios.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PUBLIC_ROOT = resolve(ROOT, 'public');
const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' https://unpkg.com; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request, limit = 256_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error('request_too_large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('invalid_json');
  }
}

async function serveStatic(pathname, response) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const filePath = resolve(PUBLIC_ROOT, relative);
  if (filePath !== PUBLIC_ROOT && !filePath.startsWith(`${PUBLIC_ROOT}${sep}`)) return false;

  try {
    const details = await stat(filePath);
    if (!details.isFile()) return false;
    const body = await readFile(filePath);
    response.writeHead(200, {
      ...SECURITY_HEADERS,
      'Cache-Control': relative.includes('/assets/') ? 'public, max-age=86400' : 'no-store',
      'Content-Type': CONTENT_TYPES[extname(filePath)] || 'application/octet-stream',
    });
    response.end(body);
    return true;
  } catch {
    return false;
  }
}

function errorStatus(error) {
  if (['run_not_found', 'action_not_found'].includes(error.message)) return 404;
  if (error.message === 'request_too_large') return 413;
  if (error.message.startsWith('qwen_')) return 502;
  return 400;
}

export function createCircuitPilotServer({ agent } = {}) {
  const runtimeAgent = agent || new CircuitPilotAgent({ planner: createPlannerFromEnv() });

  return createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://localhost');
    const { pathname } = url;

    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        ...SECURITY_HEADERS,
        Allow: 'GET, POST, OPTIONS',
      });
      response.end();
      return;
    }

    try {
      if (request.method === 'GET' && pathname === '/health') {
        sendJson(response, 200, {
          status: 'ok',
          service: 'circuitpilot',
          deployment: process.env.FC_FUNCTION_NAME
            ? { platform: 'Alibaba Cloud Function Compute', functionName: process.env.FC_FUNCTION_NAME, region: process.env.FC_REGION || 'unknown' }
            : { platform: 'local' },
          ...runtimeAgent.meta(),
        });
        return;
      }

      if (request.method === 'GET' && pathname === '/api/meta') {
        sendJson(response, 200, runtimeAgent.meta());
        return;
      }

      if (request.method === 'GET' && pathname === '/api/scenarios') {
        sendJson(response, 200, { scenarios: listScenarios() });
        return;
      }

      if (request.method === 'GET' && pathname === '/api/runs') {
        sendJson(response, 200, { runs: runtimeAgent.listRuns() });
        return;
      }

      if (request.method === 'POST' && pathname === '/api/runs') {
        const body = await readJson(request);
        const run = await runtimeAgent.startRun(body);
        sendJson(response, 201, { run });
        return;
      }

      const runMatch = pathname.match(/^\/api\/runs\/([^/]+)$/);
      if (request.method === 'GET' && runMatch) {
        const run = runtimeAgent.getRun(runMatch[1]);
        if (!run) throw new Error('run_not_found');
        sendJson(response, 200, { run });
        return;
      }

      const decisionMatch = pathname.match(/^\/api\/runs\/([^/]+)\/actions\/([^/]+)\/decision$/);
      if (request.method === 'POST' && decisionMatch) {
        const body = await readJson(request);
        const run = runtimeAgent.decide(
          decisionMatch[1],
          decisionMatch[2],
          body.decision,
          body.actor || 'operator',
        );
        sendJson(response, 200, { run });
        return;
      }

      if (request.method === 'GET' && await serveStatic(pathname, response)) return;
      sendJson(response, 404, { error: 'not_found' });
    } catch (error) {
      sendJson(response, errorStatus(error), { error: error.message || 'request_failed' });
    }
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT || 3000);
  const server = createCircuitPilotServer();
  server.listen(port, '0.0.0.0', () => {
    console.log(JSON.stringify({ service: 'circuitpilot', event: 'server_started', port }));
  });
}
