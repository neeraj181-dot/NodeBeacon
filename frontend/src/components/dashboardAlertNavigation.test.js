import test from 'node:test';
import assert from 'node:assert/strict';
import { openActiveAlerts } from './dashboardAlertNavigation.js';

test('opens the Alerts tab with the active filter and clears narrower filters', () => {
  let filters = { status: 'Resolved', severity: 'Critical', server: 'server-4' };
  const navigations = [];
  const activeAlerts = [{ id: 12 }, { id: 13 }];

  const opened = openActiveAlerts(
    activeAlerts,
    update => { filters = update(filters); },
    tab => navigations.push(tab),
  );

  assert.equal(opened, true);
  assert.deepEqual(filters, { status: 'Active', severity: '', server: '' });
  assert.deepEqual(navigations, ['alerts']);
});

test('does not navigate when there are no active alerts', () => {
  let filtersUpdated = false;
  const navigations = [];

  const opened = openActiveAlerts([], () => { filtersUpdated = true; }, tab => navigations.push(tab));

  assert.equal(opened, false);
  assert.equal(filtersUpdated, false);
  assert.deepEqual(navigations, []);
});
