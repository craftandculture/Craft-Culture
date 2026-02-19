import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { NextRequest } from 'next/server';

import createTRPCContext from '@/lib/trpc/context';
import { appRouter } from '@/trpc-router';

const handler = async (req: NextRequest) => {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createTRPCContext(),
  });
};

export { handler as GET, handler as POST };

export const maxDuration = 300;
