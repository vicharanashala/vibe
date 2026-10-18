import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import { PALETTES } from '@/lib/palettes';

import { AppearancePicker } from './appearance-picker';
import { ThemeProvider, useArtColors } from './theme-provider';

const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe('appearance', () => {
  it('defaults to light coral', () => {
    render(<AppearancePicker />, { wrapper });
    expect(document.documentElement.dataset.palette).toBe('coral');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(screen.getByRole('tab', { name: 'Light' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('offers every palette and applies a choice instantly, remembering it', async () => {
    const user = userEvent.setup();
    render(<AppearancePicker />, { wrapper });
    for (const p of PALETTES)
      expect(screen.getByText(p.name)).toBeInTheDocument();

    await user.click(screen.getByText('Teal night'));
    await user.click(screen.getByRole('tab', { name: 'Dark' }));
    expect(document.documentElement.dataset.palette).toBe('teal');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('palette')).toBe('teal');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('restores the saved theme and ignores unknown palettes', () => {
    localStorage.setItem('palette', 'mocha');
    localStorage.setItem('theme', 'dark');
    const { unmount } = render(<AppearancePicker />, { wrapper });
    expect(document.documentElement.dataset.palette).toBe('mocha');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    unmount();

    localStorage.setItem('palette', 'neon');
    render(<AppearancePicker />, { wrapper });
    expect(document.documentElement.dataset.palette).toBe('coral');
  });

  it('gives generated art the current palette’s colours', () => {
    localStorage.setItem('palette', 'sage');
    const { result } = renderHook(() => useArtColors(), { wrapper });
    expect(result.current).toEqual(PALETTES.find((p) => p.id === 'sage')!.art);
  });
});
