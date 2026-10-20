const HOST_PATTERN = /^(?=.{1,253}$)[a-z\d](?:[a-z\d.-]*[a-z\d])?$/i;

export function validateAgentTarget(host, port) {
  const value = String(host ?? '').trim();
  if (!value) return { valid: false, error: 'Enter the backend host or URL.', loopback: false };

  let parsed;
  try {
    parsed = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `http://${value}`);
  } catch {
    return { valid: false, error: 'Enter a valid host or an HTTP/HTTPS URL.', loopback: false };
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const labels = hostname.split('.');
  const validHostname = hostname.includes(':') || (HOST_PATTERN.test(hostname)
    && labels.every(label => label && label.length <= 63 && !label.startsWith('-') && !label.endsWith('-')));
  if (!['http:', 'https:'].includes(parsed.protocol) || !hostname
      || parsed.username || parsed.password || !['', '/'].includes(parsed.pathname)
      || parsed.search || parsed.hash || !validHostname) {
    return { valid: false, error: 'Use an HTTP/HTTPS host without credentials, a path, query, or fragment.', loopback: false };
  }

  const portValidation = validateAgentPort(port);
  if (!portValidation.valid) return { ...portValidation, loopback: false };

  const loopback = hostname === 'localhost' || hostname === '::1'
    || /^127(?:\.\d{1,3}){3}$/.test(hostname);
  return { valid: true, error: '', loopback };
}

export function validateAgentPort(port) {
  if (port === '' || port == null) return { valid: true, error: '' };
  const number = Number(port);
  return Number.isInteger(number) && number >= 1 && number <= 65535
    ? { valid: true, error: '' }
    : { valid: false, error: 'Port must be a whole number from 1 to 65535, or left blank.' };
}
