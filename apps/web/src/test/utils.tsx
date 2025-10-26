import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type RenderOptions, render as rtlRender } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

/**
 * Custom render function that wraps components with necessary providers
 *
 * @example
 *   const { getByText } = render(<MyComponent />);
 */
const render = (ui: ReactElement, options?: RenderOptions) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  return rtlRender(ui, { wrapper: Wrapper, ...options });
};

export * from '@testing-library/react';
export { render };
