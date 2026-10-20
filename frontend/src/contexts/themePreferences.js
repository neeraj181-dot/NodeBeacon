export const THEME_STORAGE_KEY = 'nodebeacon-theme';

export function readTheme(storage) {
  try {
    return storage?.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function persistTheme(storage, theme) {
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme === 'light' ? 'light' : 'dark');
  } catch {
    // Keep the in-memory toggle usable when browser storage is restricted.
  }
}
