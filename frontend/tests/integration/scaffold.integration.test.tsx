import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { mockEndpoint } from '../helpers/mockApi/handlers.factory';
import { useEffect, useState } from 'react';

function HealthFetcher() {
  const [data, setData] = useState<{ ok: boolean } | null>(null);
  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(setData);
  }, []);
  return <div data-testid="status">{data?.ok ? 'ok' : 'loading'}</div>;
}

describe('scaffold (frontend integration smoke)', () => {
  it('MSW intercepts and returns the default health handler', async () => {
    const { findByTestId } = renderWithProviders(<HealthFetcher />);
    const el = await findByTestId('status');
    await expect.poll(() => el.textContent).toBe('ok');
  });

  it('mockEndpoint override takes precedence', async () => {
    mockEndpoint('get', '/api/health', { ok: false });
    const { findByTestId } = renderWithProviders(<HealthFetcher />);
    const el = await findByTestId('status');
    await expect.poll(() => el.textContent).toBe('loading');
  });
});
