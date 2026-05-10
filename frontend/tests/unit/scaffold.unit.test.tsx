import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { makeUser, makeCourse, resetFixtureCounter } from '../helpers/fixtures';

describe('scaffold (frontend test infrastructure smoke)', () => {
  it('jsdom is active and renderWithProviders mounts a component', () => {
    const Hello = () => <h1>Hello, tests</h1>;
    const { getByRole } = renderWithProviders(<Hello />);
    expect(getByRole('heading', { name: /hello, tests/i })).toBeInTheDocument();
  });

  it('fixture factories produce shapes and override fields', () => {
    resetFixtureCounter();
    const u = makeUser({ email: 'override@vibe.local' });
    expect(u.email).toBe('override@vibe.local');
    expect(u.id).toMatch(/^id-\d+$/);
    expect(u.roles).toEqual(['student']);
    expect(makeCourse().name).toBe('Sample Course');
  });

  it('jest-dom matchers are wired', () => {
    const Marker = () => <span data-testid="marker">visible</span>;
    const { getByTestId } = renderWithProviders(<Marker />);
    expect(getByTestId('marker')).toBeVisible();
    expect(getByTestId('marker')).toHaveTextContent('visible');
  });
});
