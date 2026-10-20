export function collectNewActiveAlerts(alerts, previousSeenIds) {
  const seenIds = new Set(previousSeenIds);
  const unseenActive = [];

  for (const alert of alerts) {
    if (alert.status !== 'Active') continue;
    if (!seenIds.has(alert.id)) unseenActive.push(alert);
    seenIds.add(alert.id);
  }

  return { alerts: unseenActive, seenIds };
}

export function getEligibleActiveAlerts(alerts, previousSeenIds, notificationsAllowed) {
  if (!notificationsAllowed) return [];
  return collectNewActiveAlerts(alerts, previousSeenIds).alerts;
}

export function collectAlertStatusTransitions(alerts, previousStatuses = new Map()) {
  const statuses = new Map(previousStatuses);
  const recoveries = [];

  for (const alert of alerts) {
    if (statuses.get(alert.id) === 'Active' && alert.status === 'Resolved') recoveries.push(alert);
    statuses.set(alert.id, alert.status);
  }

  return { recoveries, statuses };
}

export function observeAlertSnapshot(alerts, previousSnapshot) {
  const knownIds = new Set(previousSnapshot?.knownIds || []);
  const previousStatuses = previousSnapshot?.statuses || new Map();
  const statuses = new Map(previousStatuses);
  const newActiveAlerts = [];
  const recoveries = [];

  if (!previousSnapshot?.initialized) {
    for (const alert of alerts) {
      knownIds.add(alert.id);
      statuses.set(alert.id, alert.status);
    }
    return { initialized: true, knownIds, statuses, newActiveAlerts, recoveries };
  }

  for (const alert of alerts) {
    const previousStatus = statuses.get(alert.id);
    if (alert.status === 'Active' && previousStatus !== 'Active'
      && (previousStatus !== undefined || !knownIds.has(alert.id))) {
      newActiveAlerts.push(alert);
    }
    if (previousStatus === 'Active' && alert.status === 'Resolved') recoveries.push(alert);
    knownIds.add(alert.id);
    statuses.set(alert.id, alert.status);
  }

  return { initialized: true, knownIds, statuses, newActiveAlerts, recoveries };
}

const NOTIFIED_ALERTS_STORAGE_PREFIX = 'nodebeacon-notified-alerts:';
const MAX_STORED_NOTIFIED_ALERTS = 1000;

function getStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function loadNotifiedAlertIds(storage, userId) {
  storage = getStorage(storage);
  if (!storage || userId == null) return new Set();
  try {
    const stored = JSON.parse(storage.getItem(`${NOTIFIED_ALERTS_STORAGE_PREFIX}${userId}`) || '[]');
    return new Set(Array.isArray(stored) ? stored.filter(id => typeof id === 'string' || typeof id === 'number') : []);
  } catch {
    return new Set();
  }
}

export function persistNotifiedAlertIds(storage, userId, alertIds) {
  storage = getStorage(storage);
  const ids = [...alertIds].slice(-MAX_STORED_NOTIFIED_ALERTS);
  if (storage && userId != null) {
    try {
      storage.setItem(`${NOTIFIED_ALERTS_STORAGE_PREFIX}${userId}`, JSON.stringify(ids));
    } catch {
      // Notification deduplication still works for the current session.
    }
  }
  return new Set(ids);
}

export function canDeliverDesktopNotifications(preferenceEnabled, permission) {
  return preferenceEnabled === true && permission === 'granted';
}

export function getDesktopNotificationDiagnostics({
  windowObject = globalThis.window,
  navigatorObject = globalThis.navigator,
  documentObject = globalThis.document,
} = {}) {
  const NotificationApi = windowObject?.Notification;
  return {
    apiAvailable: typeof NotificationApi === 'function',
    permission: typeof NotificationApi === 'function' ? NotificationApi.permission : 'unsupported',
    maxActions: typeof NotificationApi === 'function' && Number.isFinite(NotificationApi.maxActions)
      ? NotificationApi.maxActions
      : null,
    visibilityState: documentObject?.visibilityState || 'unavailable',
    secureContext: Boolean(windowObject?.isSecureContext),
    origin: windowObject?.location?.origin || 'unavailable',
    userAgent: navigatorObject?.userAgent || 'unavailable',
    serviceWorkerSupported: Boolean(navigatorObject?.serviceWorker),
    serviceWorkerController: Boolean(navigatorObject?.serviceWorker?.controller),
  };
}

export function watchNotificationLifecycle(notification, { onShow, onError, onClose } = {}) {
  notification.onshow = onShow || null;
  notification.onerror = onError || null;
  notification.onclose = onClose || null;
  return notification;
}

export async function requestDesktopNotificationPermission(NotificationApi = globalThis.Notification) {
  if (typeof NotificationApi !== 'function') {
    return { supported: false, permission: 'unsupported' };
  }

  if (NotificationApi.permission !== 'default') {
    return { supported: true, permission: NotificationApi.permission };
  }

  if (typeof NotificationApi.requestPermission !== 'function') {
    return { supported: false, permission: 'unsupported' };
  }

  const permission = await NotificationApi.requestPermission();
  return { supported: true, permission };
}

export async function registerNotificationServiceWorker(navigatorObject = globalThis.navigator) {
  if (!navigatorObject?.serviceWorker) return null;
  console.info('[DesktopNotification] Registering service worker');
  const registration = await navigatorObject.serviceWorker.register('/nodebeacon-sw.js', {
    scope: '/',
    updateViaCache: 'none',
  });
  console.info('[DesktopNotification] Service worker registered', { scope: registration.scope });
  navigatorObject.serviceWorker.addEventListener?.('controllerchange', () => {
    console.info('[DesktopNotification] Service worker controller:', navigatorObject.serviceWorker.controller?.scriptURL || 'none');
  });
  const readyRegistration = await navigatorObject.serviceWorker.ready;
  console.info('[DesktopNotification] Service worker ready');
  console.info('[DesktopNotification] Service worker controller:', navigatorObject.serviceWorker.controller?.scriptURL || 'none');
  return readyRegistration;
}

export async function deliverDesktopNotification(title, options, {
  navigatorObject = globalThis.navigator,
  NotificationApi = globalThis.Notification,
} = {}) {
  if (navigatorObject?.serviceWorker) {
    try {
      // `serviceWorker.ready` never settles when this origin has no registered
      // worker. Query the current registration instead so delivery can fall back.
      const registration = typeof navigatorObject.serviceWorker.getRegistration === 'function'
        ? await navigatorObject.serviceWorker.getRegistration()
        : null;
      if (registration?.showNotification) {
        console.info('[DesktopNotification] Calling showNotification');
        await registration.showNotification(title, options);
        console.info('[DesktopNotification] showNotification resolved');
        return { method: 'service-worker', registration, notification: null };
      }
      console.info('[DesktopNotification] No service worker registration on this origin; using native Notification API fallback');
    } catch (error) {
      console.error('[DesktopNotification] Service worker delivery failed; trying native Notification fallback:', error);
    }
  }

  if (typeof NotificationApi !== 'function') {
    throw new Error('Neither service-worker nor native browser notifications are available.');
  }
  const notification = new NotificationApi(title, options);
  console.info('[DesktopNotification] Native Notification API accepted the request');
  return { method: 'notification-api', registration: null, notification };
}

export async function showDesktopAlertNotification(alert, NotificationApi, onOpenAlert, focusWindow = () => {}, navigatorObject = globalThis.navigator) {
  const serverName = alert.server_details?.name || 'Unknown host';
  const notificationTitle = alert.severity
    ? `NodeBeacon — ${alert.severity} Alert`
    : `NodeBeacon: ${alert.title}`;
  const result = await deliverDesktopNotification(notificationTitle, {
    body: `Server: ${serverName}\n${alert.description || ''}`,
    icon: '/icon.png',
    tag: `nodebeacon-alert-${alert.id}`,
    renotify: false,
    data: { type: 'alert', alertId: alert.id, serverId: alert.server, status: 'Active' },
  }, { navigatorObject, NotificationApi });
  const notification = result.notification;

  if (notification) {
    notification.onclick = () => {
      focusWindow();
      onOpenAlert(alert);
      notification.close?.();
    };
  }

  return result;
}

export async function showRecoveryNotification(alert, NotificationApi, onOpenAlert = () => {}, focusWindow = () => {}, navigatorObject = globalThis.navigator) {
  const serverName = alert.server_details?.name || 'Unknown host';
  const result = await deliverDesktopNotification('NodeBeacon — Recovery', {
    body: `${serverName}: ${alert.title} has been resolved.`,
    icon: '/icon.png',
    tag: `nodebeacon-recovery-${alert.id}`,
    renotify: false,
    data: { type: 'recovery', alertId: alert.id, serverId: alert.server, status: 'Resolved' },
  }, { navigatorObject, NotificationApi });
  const notification = result.notification;

  if (notification) {
    notification.onclick = () => {
      focusWindow();
      onOpenAlert(alert);
      notification.close?.();
    };
  }

  return result;
}

export async function showTestDesktopNotification(NotificationApi = globalThis.Notification, navigatorObject = globalThis.navigator) {
  if (typeof NotificationApi !== 'function') {
    if (!navigatorObject?.serviceWorker) throw new Error('Desktop notifications are not supported by this browser.');
  }
  if (NotificationApi?.permission !== 'granted') throw new Error('Grant browser notification permission before testing.');

  return deliverDesktopNotification('NodeBeacon Test', {
    body: 'NodeBeacon desktop notification test.',
    icon: '/icon.png',
    tag: 'nodebeacon-test',
    requireInteraction: false,
  }, { NotificationApi, navigatorObject });
}
