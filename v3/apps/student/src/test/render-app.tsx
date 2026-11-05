import { render, type RenderResult } from '@testing-library/react';

import App from '@/app/app';
import { queryClient } from '@/lib/query-client';
import { createAppRouter } from '@/router';

/** Renders the whole app (providers + router) at `path`, with fresh router and query state. */
export function renderApp(path = '/'): RenderResult & { router: ReturnType<typeof createAppRouter> } {
  queryClient.clear();
  const router = createAppRouter({ initialPath: path });
  return { router, ...render(<App router={router} />) };
}
