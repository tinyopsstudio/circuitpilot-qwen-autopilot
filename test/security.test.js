import test from 'node:test';
import assert from 'node:assert/strict';
import { redactText, sanitize } from '../src/security.js';

test('redacts bearer tokens, API keys, basic auth, and email addresses', () => {
  const input = 'Bearer secret-token-123456 sk-demo_123456789012 buyer@example.com https://user:pass@example.test/path';
  const redacted = redactText(input);
  assert.doesNotMatch(redacted, /secret-token|123456789012|buyer@example|user:pass/);
  assert.match(redacted, /REDACTED/);
  assert.match(redacted, /\[email:[a-f0-9]{8}\]/);
});

test('redacts values stored under secret-shaped keys recursively', () => {
  const output = sanitize({ connector: { apiKey: 'should-not-survive', nested: { password: 'also-secret' } } });
  assert.equal(output.connector.apiKey, '[REDACTED]');
  assert.equal(output.connector.nested.password, '[REDACTED]');
});
