'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import {
  createTRPCClient,
  httpBatchStreamLink,
  loggerLink,
} from '@trpc/client';
import { useState } from 'react';
import superjson from 'superjson';

import getQueryClient from '@/lib/react-query';
import { TRPCProvider } from '@/lib/trpc/browser';
import { AppRouter } from '@/trpc-router';
import getAppUrl from '@/utils/getAppUrl';

export interface TRPCReactProviderProps {}

const TRPCReactProvider = ({
  children,
}: React.PropsWithChildren<TRPCReactProviderProps>) => {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === 'development' ||
            (op.direction === 'down' && op.result instanceof Error),
        }),
        httpBatchStreamLink({
          transformer: superjson,
          url:
            typeof window !== 'undefined'
              ? '/api/v1/trpc'
              : new URL('/api/v1/trpc', getAppUrl()).toString(),
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
};

export default TRPCReactProvider;
