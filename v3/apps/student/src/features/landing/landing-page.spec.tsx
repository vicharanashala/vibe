import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';

import { FAQS, LOGIN_HREF, NAV_LINKS, SIGNUP_HREF } from './content';

describe('Landing page', () => {
  it('renders the hero headline as the only h1', async () => {
    renderApp('/');
    const headings = await screen.findAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Learn it. Prove it. Then move on.');
  });

  it('links every nav item to a section that exists on the page', async () => {
    const { container } = renderApp('/');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    for (const link of NAV_LINKS) {
      const anchor = within(nav).getAllByRole('link', { name: link.label })[0];
      expect(anchor).toHaveAttribute('href', link.href);
      expect(container.querySelector(link.href)).not.toBeNull();
    }
  });

  it('points the calls to action at login and signup', async () => {
    renderApp('/');
    expect(await screen.findByRole('link', { name: /start learning/i })).toHaveAttribute('href', SIGNUP_HREF);
    for (const link of screen.getAllByRole('link', { name: /^log in$/i })) {
      expect(link).toHaveAttribute('href', LOGIN_HREF);
    }
  });

  it('opens an FAQ answer when its question is clicked', async () => {
    const user = userEvent.setup();
    renderApp('/');
    const [first] = FAQS;
    const trigger = await screen.findByRole('button', { name: first.q });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // The panel is labelled by its question; it must be open and hold the answer.
    // (Not toBeVisible: the scroll-reveal wrapper stays at opacity 0 in jsdom.)
    const panel = await screen.findByRole('region', { name: first.q });
    expect(panel).not.toHaveAttribute('hidden');
    expect(panel).toHaveTextContent(first.a);
  });

  it('toggles the mobile menu', async () => {
    const user = userEvent.setup();
    renderApp('/');
    const toggle = await screen.findByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const menu = await screen.findByRole('dialog');
    expect(menu).toHaveAttribute('id', 'mobile-menu');
    expect(within(menu).getByRole('link', { name: 'Get started' })).toBeInTheDocument();
  });

  it('shows the three partner logos', async () => {
    renderApp('/');
    const list = await screen.findByRole('list', { name: 'Partners' });
    for (const name of ['IIT Ropar', 'annam.ai', 'Vicharanashala Lab for Education Design']) {
      expect(within(list).getByRole('img', { name })).toBeInTheDocument();
    }
  });
});
