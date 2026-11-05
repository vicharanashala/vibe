import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ClampedText } from './studio-ui';

/** jsdom has no layout, so pretend the clamped paragraph is taller than its box (or not). */
function fakeHeights(scrollHeight: number, clientHeight: number) {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(scrollHeight);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(clientHeight);
}

afterEach(() => vi.restoreAllMocks());

describe('ClampedText', () => {
  it('offers a tap to show the rest when the text is cut off, and to hide it again', async () => {
    fakeHeights(120, 40);
    const user = userEvent.setup();
    render(<ClampedText>A long module description that doesn’t fit in two lines.</ClampedText>);
    const more = screen.getByRole('button', { name: 'Show more' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText(/A long module description/)).toHaveClass('line-clamp-2');

    await user.click(more);
    expect(screen.getByText(/A long module description/)).not.toHaveClass('line-clamp-2');
    await user.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument();
  });

  it('shows no button when the text fits', () => {
    fakeHeights(40, 40);
    render(<ClampedText>First week.</ClampedText>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
