import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const manifest = await readFile(new URL('../s.yaml', import.meta.url), 'utf8');

test('deployment manifest injects credentials without embedding them', () => {
  assert.match(manifest, /^access: circuitpilot_serverless_devs_key$/m);
  assert.match(manifest, /DASHSCOPE_API_KEY: \$\{env\('DASHSCOPE_API_KEY'\)\}/);
  assert.match(manifest, /QWEN_BASE_URL: \$\{env\('QWEN_BASE_URL', 'https:\/\/dashscope-intl\.aliyuncs\.com\/compatible-mode\/v1'\)\}/);
  assert.doesNotMatch(manifest, /^\s+FC_[A-Z0-9_]+\s*:/m);
  assert.doesNotMatch(manifest, /\bsk-[A-Za-z0-9_-]{12,}\b/);
});
