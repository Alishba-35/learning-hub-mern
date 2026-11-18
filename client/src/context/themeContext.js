import { createContext } from 'react';

export const ThemeContext = createContext({ theme: 'dark', toggleTheme: () => {} });

export const THEME_KEY = 'lh-theme';
