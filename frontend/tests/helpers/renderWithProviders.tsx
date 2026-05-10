import { type ReactElement, type ReactNode } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

export interface ProviderOptions {
  queryClient?: QueryClient;
  routerEntries?: string[];
  routerInitialIndex?: number;
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface AllProvidersProps {
  children: ReactNode;
  options: ProviderOptions;
}

function AllProviders({ children, options }: AllProvidersProps) {
  const client = options.queryClient ?? makeQueryClient();
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={options.routerEntries ?? ['/']} initialIndex={options.routerInitialIndex}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options: ProviderOptions & Omit<RenderOptions, 'wrapper'> = {}
): RenderResult & { queryClient: QueryClient } {
  const { queryClient: providedClient, routerEntries, routerInitialIndex, ...renderOptions } = options;
  const queryClient = providedClient ?? makeQueryClient();
  const result = render(ui, {
    wrapper: ({ children }) => (
      <AllProviders options={{ queryClient, routerEntries, routerInitialIndex }}>{children}</AllProviders>
    ),
    ...renderOptions,
  });
  return { ...result, queryClient };
}
