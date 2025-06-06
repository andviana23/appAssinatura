import React from 'react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeProviderContext = React.createContext<ThemeProviderState | undefined>(undefined);

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  storageKey = 'trato-barbados-theme',
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>('dark');

  React.useEffect(() => {
    try {
      const stored = localStorage?.getItem(storageKey);
      if (stored && ['dark', 'light', 'system'].includes(stored)) {
        setThemeState(stored as Theme);
      } else {
        setThemeState(defaultTheme);
      }
    } catch {
      setThemeState(defaultTheme);
    }
  }, [defaultTheme, storageKey]);

  React.useEffect(() => {
    try {
      const root = document.documentElement;
      root.classList.remove('light', 'dark');

      if (theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        root.classList.add(systemTheme);
      } else {
        root.classList.add(theme);
      }
    } catch {
      // Fallback to dark theme
      document.documentElement.classList.add('dark');
    }
  }, [theme]);

  const setTheme = React.useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage?.setItem(storageKey, newTheme);
    } catch {
      // Ignore localStorage errors
    }
  }, [storageKey]);

  const value = React.useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};