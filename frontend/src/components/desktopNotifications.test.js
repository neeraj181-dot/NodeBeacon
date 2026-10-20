import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collectNewActiveAlerts,
  canDeliverDesktopNotifications,
  loadNotifiedAlertIds,
  persistNotifiedAlertIds,
  getEligibleActiveAlerts,
  observeAlertSnapshot,
  collectAlertStatusTransitions,
  requestDesktopNotificationPermission,
  showDesktopAlertNotification,
  showRecoveryNotification,
  showTestDesktopNotification,
  getDesktopNotificationDiagnostics,
  watchNotificationLifecycle,
  deliverDesktopNotification,
  registerNotificationServiceWorker,
} from './desktopNotifications.js';

test('collects only active alerts not already seen and records active IDs', () => {
  const result = collectNewActiveAlerts([
    { id: 1, status: 'Active' },
    { id: 2, status: 'Resolved' },
    { id: 3, status: 'Active' },
  ], new Set([1]));

  assert.deepEqual(result.alerts, [{ id: 3, status: 'Active' }]);
  assert.deepEqual([...result.seenIds].sort(), [1, 3]);
});

test('persists seen alert IDs across reloads and scopes them to the signed-in user', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  persistNotifiedAlertIds(storage, 7, new Set([12, 13]));

  const restoredIds = loadNotifiedAlertIds(storage, 7);
  assert.deepEqual([...restoredIds], [12, 13]);
  assert.deepEqual(collectNewActiveAlerts([{ id: 12, status: 'Active' }], restoredIds).alerts, []);
  assert.deepEqual([...loadNotifiedAlertIds(storage, 8)], []);
});

test('allows delivery only when the preference is enabled and browser permission is granted', () => {
  assert.equal(canDeliverDesktopNotifications(true, 'granted'), true);
  assert.equal(canDeliverDesktopNotifications(false, 'granted'), false);
  assert.equal(canDeliverDesktopNotifications(true, 'denied'), false);
  assert.equal(canDeliverDesktopNotifications(true, 'default'), false);
});

test('keeps active alerts eligible until desktop notifications are allowed', () => {
  const active = [{ id: 21, status: 'Active' }];
  const alreadyNotified = new Set();

  assert.deepEqual(getEligibleActiveAlerts(active, alreadyNotified, false), []);
  assert.deepEqual(getEligibleActiveAlerts(active, alreadyNotified, true), active);
  assert.equal(alreadyNotified.size, 0);
});

test('detects one recovery transition after an active alert and not on later polls', () => {
  const active = { id: 31, status: 'Active' };
  const resolved = { ...active, status: 'Resolved' };
  const initial = collectAlertStatusTransitions([active], new Map());
  const recovered = collectAlertStatusTransitions([resolved], initial.statuses);
  const repeated = collectAlertStatusTransitions([resolved], recovered.statuses);

  assert.deepEqual(initial.recoveries, []);
  assert.deepEqual(recovered.recoveries, [resolved]);
  assert.deepEqual(repeated.recoveries, []);
});

test('treats the first successful alert snapshot as existing and notifies only for later new active alerts', () => {
  const existing = { id: 51, status: 'Active' };
  const first = observeAlertSnapshot([existing], null);

  assert.deepEqual(first.newActiveAlerts, []);
  assert.deepEqual(first.recoveries, []);
  assert.equal(first.initialized, true);

  const newlyCreated = { id: 52, status: 'Active' };
  const second = observeAlertSnapshot([existing, newlyCreated], first);
  assert.deepEqual(second.newActiveAlerts, [newlyCreated]);
  assert.deepEqual(second.recoveries, []);

  const repeated = observeAlertSnapshot([existing, newlyCreated], second);
  assert.deepEqual(repeated.newActiveAlerts, []);
  assert.deepEqual(repeated.recoveries, []);
});

test('detects recovery once and permits a later re-created alert with a new ID', () => {
  const active = { id: 61, status: 'Active' };
  const baseline = observeAlertSnapshot([active], null);
  const resolved = { ...active, status: 'Resolved' };
  const recovery = observeAlertSnapshot([resolved], baseline);
  assert.deepEqual(recovery.recoveries, [resolved]);

  const repeatedRecovery = observeAlertSnapshot([resolved], recovery);
  assert.deepEqual(repeatedRecovery.recoveries, []);

  const recreated = { id: 62, status: 'Active' };
  const newAlert = observeAlertSnapshot([resolved, recreated], recovery);
  assert.deepEqual(newAlert.newActiveAlerts, [recreated]);
});

test('does not request browser permission again when it is already denied', async () => {
  let requested = false;
  class DeniedNotification { static permission = 'denied'; static requestPermission() { requested = true; } }

  assert.deepEqual(await requestDesktopNotificationPermission(DeniedNotification), { supported: true, permission: 'denied' });
  assert.equal(requested, false);
});

test('requests permission only when the browser has not decided yet', async () => {
  let requests = 0;
  class PendingNotification {
    static permission = 'default';
    static async requestPermission() { requests += 1; return 'granted'; }
  }

  assert.deepEqual(await requestDesktopNotificationPermission(PendingNotification), { supported: true, permission: 'granted' });
  assert.equal(requests, 1);
});

test('reports browsers without the Notification API as unsupported', async () => {
  assert.deepEqual(await requestDesktopNotificationPermission(undefined), { supported: false, permission: 'unsupported' });
});

test('creates a native alert notification that focuses and opens the relevant alert view', async () => {
  let details;
  let clickHandler;
  let focused = false;
  let openedAlert;
  class FakeNotification {
    constructor(title, options) { details = { title, options }; }
    set onclick(handler) { clickHandler = handler; }
  }
  const alert = { id: 9, title: 'High CPU', description: 'CPU exceeded 90%', server_details: { name: 'edge-1' } };

  await showDesktopAlertNotification(alert, FakeNotification, value => { openedAlert = value; }, () => { focused = true; }, {});
  clickHandler();

  assert.equal(details.title, 'NodeBeacon: High CPU');
  assert.match(details.options.body, /edge-1/);
  assert.equal(details.options.tag, 'nodebeacon-alert-9');
  assert.equal(details.options.icon, '/icon.png');
  assert.equal(details.options.renotify, false);
  assert.equal(focused, true);
  assert.equal(openedAlert, alert);
});

test('CPU notification includes server, measured usage, and configured threshold', async () => {
  let details;
  class FakeNotification { constructor(title, options) { details = { title, options }; } }
  const alert = {
    id: 10,
    title: 'High CPU Usage',
    description: 'CPU usage is 11%, exceeding the critical 10% limit.',
    server_details: { name: 'workstation' },
  };

  await showDesktopAlertNotification(alert, FakeNotification, () => {}, () => {}, {});

  assert.match(details.options.body, /workstation/);
  assert.match(details.options.body, /11%/);
  assert.match(details.options.body, /10%/);
});

test('recovery toast uses a distinct stable tag and explains the resolved alert', async () => {
  let details;
  class FakeNotification { constructor(title, options) { details = { title, options }; } }
  const alert = { id: 41, title: 'High CPU Usage', status: 'Resolved', server_details: { name: 'workstation' } };

  await showRecoveryNotification(alert, FakeNotification, () => {}, () => {}, {});

  assert.equal(details.title, 'NodeBeacon — Recovery');
  assert.match(details.options.body, /workstation/);
  assert.match(details.options.body, /High CPU Usage/);
  assert.equal(details.options.tag, 'nodebeacon-recovery-41');
  assert.equal(details.options.icon, '/icon.png');
});

test('test toast uses the direct Notification API and clear test copy', async () => {
  let details;
  class GrantedNotification {
    static permission = 'granted';
    constructor(title, options) { details = { title, options }; }
  }

  const result = await showTestDesktopNotification(GrantedNotification, {});

  assert.equal(result.method, 'notification-api');
  assert.equal(details.title, 'NodeBeacon Test');
  assert.equal(details.options.body, 'NodeBeacon desktop notification test.');
  assert.equal(details.options.icon, '/icon.png');
});

test('reports browser API and origin diagnostics without assuming OS delivery', () => {
  class BrowserNotification { static permission = 'granted'; static maxActions = 2; }
  const diagnostics = getDesktopNotificationDiagnostics({
    windowObject: { Notification: BrowserNotification, isSecureContext: true, location: { origin: 'http://localhost:5173' } },
    navigatorObject: { userAgent: 'Chrome test', serviceWorker: {} },
    documentObject: { visibilityState: 'visible' },
  });

  assert.deepEqual(diagnostics, {
    apiAvailable: true,
    permission: 'granted',
    maxActions: 2,
    visibilityState: 'visible',
    secureContext: true,
    origin: 'http://localhost:5173',
    userAgent: 'Chrome test',
    serviceWorkerSupported: true,
    serviceWorkerController: false,
  });
});

test('treats notification show as a lifecycle event, not immediate constructor success', () => {
  let handlers;
  let shown = 0;
  let errored = 0;
  let closed = 0;
  const notification = {};

  watchNotificationLifecycle(notification, {
    onShow: () => { shown += 1; },
    onError: () => { errored += 1; },
    onClose: () => { closed += 1; },
  });
  handlers = notification;

  assert.deepEqual([shown, errored, closed], [0, 0, 0]);
  handlers.onshow();
  handlers.onerror({ type: 'error' });
  handlers.onclose();
  assert.deepEqual([shown, errored, closed], [1, 1, 1]);
});

test('prefers an active service worker notification and does not also create a page notification', async () => {
  let shown;
  let nativeCalls = 0;
  const registration = { showNotification: async (title, options) => { shown = { title, options }; } };
  class NativeNotification { constructor() { nativeCalls += 1; } }
  const navigatorObject = {
    serviceWorker: {
      controller: { state: 'activated' },
      getRegistration: async () => registration,
      ready: Promise.resolve(registration),
    },
  };

  const result = await deliverDesktopNotification('NodeBeacon Test', { body: 'test' }, { navigatorObject, NotificationApi: NativeNotification });
  assert.equal(result.method, 'service-worker');
  assert.deepEqual(shown, { title: 'NodeBeacon Test', options: { body: 'test' } });
  assert.equal(nativeCalls, 0);
});

test('falls back to a native test notification immediately when no service worker is registered', async () => {
  let nativeCalls = 0;
  class NativeNotification {
    static permission = 'granted';
    constructor() { nativeCalls += 1; }
  }
  const navigatorObject = {
    serviceWorker: {
      getRegistration: async () => undefined,
      // `ready` remains pending when this origin has never registered a worker.
      ready: new Promise(() => {}),
    },
  };

  const result = await showTestDesktopNotification(NativeNotification, navigatorObject);

  assert.equal(result.method, 'notification-api');
  assert.equal(nativeCalls, 1);
});

test('sends real alert IDs and status through the service-worker notification path', async () => {
  let showArgs;
  const registration = { showNotification: async (...args) => { showArgs = args; } };
  const navigatorObject = { serviceWorker: { controller: {}, getRegistration: async () => registration, ready: Promise.resolve(registration) } };
  class NativeNotification { static permission = 'granted'; }
  const alert = { id: 123, server: 7, status: 'Active', title: 'Disk usage critical', description: 'Disk at 98%', server_details: { name: 'node-7' } };

  const result = await showDesktopAlertNotification(alert, NativeNotification, () => {}, () => {}, navigatorObject);
  assert.equal(result.method, 'service-worker');
  assert.equal(showArgs[0], 'NodeBeacon: Disk usage critical');
  assert.equal(showArgs[1].tag, 'nodebeacon-alert-123');
  assert.deepEqual(showArgs[1].data, { type: 'alert', alertId: 123, serverId: 7, status: 'Active' });
});

test('falls back to the page Notification API when service workers are unavailable', async () => {
  let created;
  class NativeNotification { constructor(title, options) { created = { title, options }; } }
  const result = await deliverDesktopNotification('NodeBeacon Test', { body: 'test' }, { navigatorObject: {}, NotificationApi: NativeNotification });

  assert.equal(result.method, 'notification-api');
  assert.deepEqual(created, { title: 'NodeBeacon Test', options: { body: 'test' } });
});

test('falls back to the page Notification API if service-worker delivery rejects', async () => {
  let nativeCalls = 0;
  class NativeNotification { constructor() { nativeCalls += 1; } }
  const navigatorObject = { serviceWorker: { controller: null, getRegistration: async () => ({ showNotification: async () => { throw new Error('worker unavailable'); } }), ready: Promise.resolve({ showNotification: async () => { throw new Error('worker unavailable'); } }) } };
  const result = await deliverDesktopNotification('NodeBeacon Test', { body: 'test' }, { navigatorObject, NotificationApi: NativeNotification });

  assert.equal(result.method, 'notification-api');
  assert.equal(nativeCalls, 1);
});

test('registers the root-scoped worker and waits for its ready registration', async () => {
  let registrationCall;
  const registration = { scope: 'http://localhost:5173/', showNotification() {} };
  const navigatorObject = {
    serviceWorker: {
      controller: null,
      register: async (...args) => { registrationCall = args; return registration; },
      ready: Promise.resolve(registration),
      addEventListener() {},
    },
  };

  const ready = await registerNotificationServiceWorker(navigatorObject);
  assert.deepEqual(registrationCall, ['/nodebeacon-sw.js', { scope: '/', updateViaCache: 'none' }]);
  assert.equal(ready, registration);
});

test('delivers a test notification via working service worker registration', async () => {
  let shownArgs;
  let nativeCalls = 0;
  const registration = {
    showNotification: async (...args) => { shownArgs = args; },
  };
  class GrantedNotification {
    static permission = 'granted';
    constructor() { nativeCalls += 1; }
  }
  const navigatorObject = {
    serviceWorker: {
      getRegistration: async () => registration,
    },
  };

  const result = await showTestDesktopNotification(GrantedNotification, navigatorObject);
  assert.equal(result.method, 'service-worker');
  assert.equal(result.registration, registration);
  assert.equal(shownArgs[0], 'NodeBeacon Test');
  assert.deepEqual(shownArgs[1], {
    body: 'NodeBeacon desktop notification test.',
    icon: '/icon.png',
    tag: 'nodebeacon-test',
    requireInteraction: false,
  });
  assert.equal(nativeCalls, 0);
});

test('falls back to native notification when test notification service-worker showNotification fails', async () => {
  let nativeCalls = 0;
  let nativeOptions;
  class NativeNotification {
    static permission = 'granted';
    constructor(title, options) {
      nativeCalls += 1;
      nativeOptions = { title, options };
    }
  }
  const navigatorObject = {
    serviceWorker: {
      getRegistration: async () => ({
        showNotification: async () => { throw new Error('Service worker crashed'); },
      }),
    },
  };

  const result = await showTestDesktopNotification(NativeNotification, navigatorObject);
  assert.equal(result.method, 'notification-api');
  assert.equal(nativeCalls, 1);
  assert.equal(nativeOptions.title, 'NodeBeacon Test');
});

test('rejects test notification when permission is denied or not granted', async () => {
  class DeniedNotification {
    static permission = 'denied';
  }
  await assert.rejects(
    async () => showTestDesktopNotification(DeniedNotification, {}),
    { message: 'Grant browser notification permission before testing.' }
  );

  class DefaultNotification {
    static permission = 'default';
  }
  await assert.rejects(
    async () => showTestDesktopNotification(DefaultNotification, {}),
    { message: 'Grant browser notification permission before testing.' }
  );
});

