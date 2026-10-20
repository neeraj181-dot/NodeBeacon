import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAgentPort, validateAgentTarget } from './agentDeploymentUtils.js';

test('accepts an explicitly configured local backend and warns that it is local', () => {
  assert.deepEqual(validateAgentTarget('http://127.0.0.1', '8000'), {
    valid: true, error: '', loopback: true,
  });
});

test('accepts a remote HTTP or HTTPS hostname without rewriting it', () => {
  assert.equal(validateAgentTarget('https://api.example.com', '').valid, true);
  assert.equal(validateAgentTarget('api.example.com', '8443').valid, true);
  assert.equal(validateAgentTarget('https://api.example.com', '').loopback, false);
});

test('rejects blank hosts, non-HTTP schemes, credentials, paths, and malformed hosts', () => {
  for (const host of ['', 'ftp://api.example.com', 'https://user:pass@example.com',
    'https://api.example.com/private', 'not a host']) {
    assert.equal(validateAgentTarget(host, '').valid, false, `Expected ${host} to be invalid`);
  }
});

test('rejects non-integer and out-of-range ports', () => {
  for (const port of ['0', '65536', '8000.5', 'abc']) {
    assert.equal(validateAgentTarget('http://127.0.0.1', port).valid, false, `Expected ${port} to be invalid`);
    assert.equal(validateAgentPort(port).valid, false, `Expected the port field to reject ${port}`);
  }
  assert.equal(validateAgentPort('').valid, true);
  assert.equal(validateAgentTarget('http://127.0.0.1', '65535').valid, true);
});
