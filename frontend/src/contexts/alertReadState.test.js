import test from 'node:test';
import assert from 'node:assert/strict';
import { countUnreadAlerts, loadReadAlertIds, mergeReadAlertIds, persistReadAlertIds } from './alertReadState.js';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test('marking viewed alerts persists their IDs for the signed-in user', () => {
  const storage = createStorage();
  const viewed = persistReadAlertIds(storage, 42, new Set(), [7]);

  assert.deepEqual([...viewed], ['7']);
  assert.deepEqual([...loadReadAlertIds(storage, 42)], ['7']);
  assert.equal(countUnreadAlerts([{ id: 7, status: 'Active' }], viewed), 0);
});

test('viewing multiple alerts marks all viewed IDs while a later alert stays unread', () => {
  const storage = createStorage();
  const viewed = persistReadAlertIds(storage, 42, new Set(), [7, 8, 9]);
  const alerts = [{ id: 7 }, { id: 8 }, { id: 9 }, { id: 10 }];
  assert.equal(countUnreadAlerts(alerts, viewed), 1);
  assert.equal(countUnreadAlerts([...alerts, { id: 11, status: 'Active' }], viewed), 2);
  assert.deepEqual([...loadReadAlertIds(storage, 42)], ['7', '8', '9']);
});

test('read alert IDs are isolated by account and malformed storage safely falls back', () => {
  const storage = createStorage({ 'nodebeacon-read-alerts:42': 'not-json' });
  assert.deepEqual([...loadReadAlertIds(storage, 42)], []);
  assert.deepEqual([...loadReadAlertIds(storage, 43)], []);
  assert.deepEqual([...mergeReadAlertIds(new Set(['2']), [3])], ['2', '3']);
});
