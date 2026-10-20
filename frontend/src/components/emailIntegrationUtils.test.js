import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEmailFormat,
  computeEmailIntegrationStatus,
  countActiveEmailPreferences,
  isVerificationCodeValid,
  formatCooldownTime,
} from './emailIntegrationUtils.js';

test('validateEmailFormat accepts valid standard email addresses', () => {
  assert.equal(validateEmailFormat('admin@example.com'), true);
  assert.equal(validateEmailFormat('dev.team+alerts@nodebeacon.io'), true);
  assert.equal(validateEmailFormat('first.last@sub.domain.co.uk'), true);
});

test('validateEmailFormat rejects malformed addresses and header injection attempts', () => {
  assert.equal(validateEmailFormat(''), false);
  assert.equal(validateEmailFormat('plainaddress'), false);
  assert.equal(validateEmailFormat('@missingusername.com'), false);
  assert.equal(validateEmailFormat('user@.com'), false);
  assert.equal(validateEmailFormat('user@example.com\nBcc: hacker@bad.com'), false);
  assert.equal(validateEmailFormat('user@example.com\r\nSubject: Injected'), false);
});

test('computeEmailIntegrationStatus identifies all supported connection states', () => {
  // Not configured
  assert.equal(computeEmailIntegrationStatus({ configured: false }), 'not_configured');

  // Error when configured is false but emails are stored
  assert.equal(computeEmailIntegrationStatus({ configured: false, recipient_email: 'foo@bar.com' }), 'error');

  // Not connected
  assert.equal(computeEmailIntegrationStatus({ configured: true, is_verified: false, recipient_email: '' }), 'not_connected');

  // Pending verification
  assert.equal(computeEmailIntegrationStatus({
    configured: true,
    is_verified: false,
    unverified_email: 'pending@bar.com',
  }), 'pending_verification');

  // Connected
  assert.equal(computeEmailIntegrationStatus({
    configured: true,
    is_verified: true,
    recipient_email: 'verified@bar.com',
  }), 'connected');
});

test('countActiveEmailPreferences tallies enabled categories correctly', () => {
  assert.equal(countActiveEmailPreferences({
    notify_offline_email: true,
    notify_critical_email: true,
    notify_on_laptop_unlock: true,
  }), 3);

  assert.equal(countActiveEmailPreferences({
    notify_offline_email: true,
    notify_critical_email: false,
    notify_on_laptop_unlock: false,
  }), 1);

  assert.equal(countActiveEmailPreferences({
    notify_offline_email: false,
    notify_critical_email: false,
    notify_on_laptop_unlock: false,
  }), 0);
});

test('isVerificationCodeValid enforces 6 numeric digits', () => {
  assert.equal(isVerificationCodeValid('123456'), true);
  assert.equal(isVerificationCodeValid('000000'), true);
  assert.equal(isVerificationCodeValid(' 987654 '), true); // trims whitespace
  assert.equal(isVerificationCodeValid('12345'), false);   // 5 digits
  assert.equal(isVerificationCodeValid('1234567'), false); // 7 digits
  assert.equal(isVerificationCodeValid('12345a'), false);  // contains alpha
  assert.equal(isVerificationCodeValid(''), false);
});

test('formatCooldownTime formats seconds and minutes cleanly', () => {
  assert.equal(formatCooldownTime(45), '45s');
  assert.equal(formatCooldownTime(60), '1m');
  assert.equal(formatCooldownTime(75), '1m 15s');
  assert.equal(formatCooldownTime(0), '0s');
  assert.equal(formatCooldownTime(-10), '0s');
});
