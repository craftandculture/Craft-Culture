import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';

import sendClientQuote from '../data/sendClientQuote';

/**
 * Send the client their freight quotation from logistics@
 *
 * See `sendClientQuote` for what goes and what is recorded.
 *
 * @example
 *   await trpcClient.logistics.admin.requests.sendClientQuote.mutate({ requestId, to: 'client@example.com' });
 */
const adminSendClientQuote = adminProcedure
  .input(
    z.object({
      requestId: z.string().uuid(),
      to: z.string().trim().email('Enter a valid email').optional(),
    }),
  )
  .mutation(({ input, ctx }) => sendClientQuote(input, ctx.user));

export default adminSendClientQuote;
