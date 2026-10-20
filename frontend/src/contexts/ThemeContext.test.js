import { test } from 'node:test';
import assert from 'node:assert/strict';
import { persistTheme, readTheme } from './themePreferences.js';

function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, value),
  };
}

test('defaults to dark when no saved preference exists', () => {
  assert.equal(readTheme(storage()), 'dark');
});

test('restores light mode and preserves it after a fresh provider reads storage', () => {
  const browserStorage = storage();
  persistTheme(browserStorage, 'light');
  assert.equal(readTheme(browserStorage), 'light');
});

test('restores dark mode after switching back', () => {
  const browserStorage = storage({'nodebeacon-theme': 'light'});
  persistTheme(browserStorage, 'dark');
  assert.equal(readTheme(browserStorage), 'dark');
});

test('falls back safely if browser storage is blocked or contains an invalid value', () => {
  assert.equal(readTheme({getItem: () => { throw new Error('blocked'); }}), 'dark');
  assert.equal(readTheme(storage({'nodebeacon-theme': 'sepia'})), 'dark');
});
