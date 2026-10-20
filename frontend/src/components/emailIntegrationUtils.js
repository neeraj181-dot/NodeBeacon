/**
 * Helper utilities for Email Notifications Integration in NodeBeacon.
 */

export function validateEmailFormat(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length > 254 || trimmed.includes('\n') || trimmed.includes('\r')) return false;
  // Standard RFC 5322 compatible regex
  const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return regex.test(trimmed);
}

export function computeEmailIntegrationStatus(settings) {
  if (!settings || !settings.configured) {
    if (settings && (settings.recipient_email || settings.unverified_email)) {
      return 'error';
    }
    return 'not_configured';
  }
  if (settings.is_verified && settings.recipient_email) {
    return 'connected';
  }
  if (settings.unverified_email || settings.status === 'pending_verification') {
    return 'pending_verification';
  }
  if (settings.status === 'error') {
    return 'error';
  }
  return 'not_connected';
}

export function countActiveEmailPreferences(settings) {
  if (!settings) return 0;
  let count = 0;
  if (settings.notify_offline_email) count += 1;
  if (settings.notify_critical_email) count += 1;
  if (settings.notify_on_laptop_unlock) count += 1;
  return count;
}

export function isVerificationCodeValid(code) {
  if (!code || typeof code !== 'string') return false;
  const clean = code.trim();
  return /^\d{6}$/.test(clean);
}

export function formatCooldownTime(seconds) {
  const secs = Math.max(0, parseInt(seconds, 10) || 0);
  if (secs >= 60) {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
  }
  return `${secs}s`;
}
