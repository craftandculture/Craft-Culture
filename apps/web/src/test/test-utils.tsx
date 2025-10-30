import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RenderOptions, render } from '@testing-library/react';
import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import React, { ReactElement } from 'react';
import { vi } from 'vitest';

import type { AppRouter } from '@/trpc-router';

/**
 * Create a tRPC client for testing
 */
const createTestTRPC = () => {
  return createTRPCReact<AppRouter>();
};

/**
 * Create a test wrapper with all required providers
 */
export const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
    },
  });

  const trpc = createTestTRPC();

  const trpcClient = trpc.createClient({
    links: [
      httpBatchLink({
        url: 'http://localhost:3000/api/trpc',
        fetch: vi.fn(),
      }),
    ],
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    return (
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </trpc.Provider>
    );
  };

  return {
    Wrapper,
    queryClient,
    trpcClient,
    trpc,
  };
};

/**
 * Custom render with all providers
 */
export const renderWithProviders = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => {
  const { Wrapper } = createTestWrapper();
  return render(ui, { wrapper: Wrapper, ...options });
};

/**
 * Re-export everything from testing library
 */
export * from '@testing-library/react';
export { renderWithProviders as render };
