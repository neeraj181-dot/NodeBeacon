import test from 'node:test';
import assert from 'node:assert/strict';
import { formatAlertDuration } from './alertDuration.js';

test('formats elapsed incident duration from its actual timestamps', () => {
  assert.equal(formatAlertDuration('2026-10-04T10:00:00Z', '2026-10-05T12:34:56Z'), '1d 2h');
  assert.equal(formatAlertDuration('2026-10-05T10:00:00Z', '2026-10-05T12:34:56Z'), '2h 34m');
  assert.equal(formatAlertDuration('2026-10-05T12:34:00Z', '2026-10-05T12:34:45Z'), '45s');
});

test('returns a safe fallback when the incident timestamp is invalid', () => {
  assert.equal(formatAlertDuration('invalid', '2026-10-05T12:34:56Z'), 'Unavailable');
});
