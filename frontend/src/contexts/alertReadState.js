const keyForUser = userId => userId == null ? null : `nodebeacon-read-alerts:${userId}`;

export function loadReadAlertIds(storage, userId) {
  const key = keyForUser(userId);
  if (!storage || !key) return new Set();

  try {
    const values = JSON.parse(storage.getItem(key) || '[]');
    return new Set(Array.isArray(values) ? values.map(String) : []);
  } catch {
    return new Set();
  }
}

export function mergeReadAlertIds(currentIds, viewedIds) {
  return new Set([...currentIds, ...viewedIds.filter(id => id != null).map(String)]);
}

export function countUnreadAlerts(alerts, readIds) {
  return alerts.filter(alert => !readIds.has(String(alert.id))).length;
}

export function persistReadAlertIds(storage, userId, currentIds, viewedIds) {
  const merged = mergeReadAlertIds(currentIds, viewedIds);
  const key = keyForUser(userId);
  if (storage && key) {
    try {
      storage.setItem(key, JSON.stringify([...merged]));
    } catch {
      // Keep read state for this page session if persistent storage is unavailable.
    }
  }
  return merged;
}
