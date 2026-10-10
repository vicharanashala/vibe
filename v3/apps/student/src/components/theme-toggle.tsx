import { Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { useTheme } from './theme-provider';

/** Light/dark switch. Light is the app default. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={isDark}
      className={className}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
