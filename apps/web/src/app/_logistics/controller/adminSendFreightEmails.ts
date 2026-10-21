import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';

import sendFreightEmails from '../data/sendFreightEmails';

/**
 * Send a freight email from logistics@ to one or more forwarders
 *
 * See `sendFreightEmails` for what goes and what is recorded.
 *
 * @example
 *   await trpcClient.logistics.admin.requests.sendEmails.mutate({ requestId, kind: 'request', forwarderIds: [a, b] });
 */
const adminSendFreightEmails = adminProcedure
  .input(
    z.object({
      requestId: z.string().uuid(),
      kind: z.enum(['request', 'chase', 'award', 'decline']),
      forwarderIds: z.array(z.string().uuid()).min(1).max(20),
    }),
  )
  .mutation(({ input, ctx }) => sendFreightEmails(input, ctx.user));

export default adminSendFreightEmails;
