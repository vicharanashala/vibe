import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';

describe('Theme', () => {
  it('defaults to light, even when the system prefers dark', async () => {
    vi.mocked(window.matchMedia).mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('dark'),
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
          onchange: null,
        }) as MediaQueryList,
    );
    renderApp('/');
    await screen.findAllByRole('heading', { level: 1 });
    expect(document.documentElement).toHaveClass('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('switches to dark and back', async () => {
    const user = userEvent.setup();
    renderApp('/');
    const [toggle] = await screen.findAllByRole('button', { name: 'Switch to dark theme' });

    await user.click(toggle);
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('dark');

    const [back] = screen.getAllByRole('button', { name: 'Switch to light theme' });
    await user.click(back);
    expect(document.documentElement).not.toHaveClass('dark');
  });
});
