import { useCallback, useEffect, useMemo, useState } from 'react';
import { ThemeContext, THEME_KEY } from './themeContext.js';

const readSaved = () => {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'light' || saved === 'dark' ? saved : null;
  } catch {
    return null; // private window / storage band: bina saved choice ke chalta hai
  }
};

// Page par theme lagata hai: <html data-theme> (hamari CSS) aur data-bs-theme (Bootstrap ke apne widgets)
function applyTheme(theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-bs-theme', theme);
}

// Default dark hai (purana look). User ki choice browser mein yaad rehti hai.
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => readSaved() ?? 'dark');

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* save na ho to bhi theme badal jati hai */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
