import { createHash } from 'node:crypto';

const SECRET_KEY = /(api[-_]?key|access[-_]?key|authorization|bearer|credential|password|secret|token)/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const TOKEN = /\b(?:sk|ak|rk|pk)[-_][A-Za-z0-9_-]{12,}\b/g;
const BASIC_AUTH_URL = /(https?:\/\/)([^\s/:]+):([^\s@]+)@/gi;

export function safeHash(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function emailAlias(value) {
  return `[email:${safeHash(String(value).toLowerCase()).slice(0, 8)}]`;
}

export function redactText(value) {
  return String(value ?? '')
    .replace(BEARER, 'Bearer [REDACTED]')
    .replace(TOKEN, '[REDACTED_TOKEN]')
    .replace(BASIC_AUTH_URL, '$1[REDACTED]@')
    .replace(EMAIL, emailAlias);
}

export function sanitize(value, depth = 0) {
  if (depth > 8) return '[TRUNCATED]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactText(value).slice(0, 12_000);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitize(item, depth + 1));
  if (typeof value !== 'object') return redactText(value);

  const output = {};
  for (const [key, nested] of Object.entries(value).slice(0, 100)) {
    output[key] = SECRET_KEY.test(key) ? '[REDACTED]' : sanitize(nested, depth + 1);
  }
  return output;
}

export function compactJson(value, maxLength = 24_000) {
  const serialized = JSON.stringify(sanitize(value));
  return serialized.length <= maxLength
    ? serialized
    : `${serialized.slice(0, maxLength)}...[TRUNCATED]`;
}
