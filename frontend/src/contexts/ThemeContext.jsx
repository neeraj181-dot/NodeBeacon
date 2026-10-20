import React, { createContext, useContext, useLayoutEffect, useState } from 'react';
import { readTheme, persistTheme } from './themePreferences';

const ThemeContext = createContext(null);
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => readTheme(window.localStorage));
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    persistTheme(window.localStorage, theme);
  }, [theme]);
  const toggleTheme = () => setTheme(current => current === 'dark' ? 'light' : 'dark');
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider.');
  return value;
}
