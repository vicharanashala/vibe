import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  DEFAULT_PALETTE,
  isPaletteId,
  paletteById,
  type PaletteId,
} from '@/lib/palettes';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';
const PALETTE_KEY = 'palette';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  palette: PaletteId;
  setPalette: (palette: PaletteId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode) — the in-memory choice still applies
  }
}

/**
 * Light/dark mode plus a colour palette (see lib/palettes.ts), one theme for
 * the whole app — student pages and the studio alike. Light + coral by default
 * (system preference is deliberately ignored); choices are remembered in
 * localStorage and applied to <html> as the `dark` class and `data-palette`.
 * index.html applies the same two before React loads, so there's no flash.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() =>
    read(STORAGE_KEY) === 'dark' ? 'dark' : 'light',
  );
  const [palette, setPaletteState] = useState<PaletteId>(() => {
    const stored = read(PALETTE_KEY);
    return isPaletteId(stored) ? stored : DEFAULT_PALETTE;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.palette = palette;
  }, [palette]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    write(STORAGE_KEY, next);
  }, []);

  const setPalette = useCallback((next: PaletteId) => {
    setPaletteState(next);
    write(PALETTE_KEY, next);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
      palette,
      setPalette,
    }),
    [theme, setTheme, palette, setPalette],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

/** Colours for generated art in the current palette (default palette outside a provider, e.g. in isolated tests). */
export function useArtColors(): readonly string[] {
  const ctx = useContext(ThemeContext);
  return paletteById(ctx?.palette ?? DEFAULT_PALETTE).art;
}
