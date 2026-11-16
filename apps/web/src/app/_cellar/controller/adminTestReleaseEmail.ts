import { z } from 'zod';

import { staffAdminProcedure } from '@/lib/trpc/procedures';

import emailStaffOfRelease from '../data/emailStaffOfRelease';

/**
 * Send the team's release email for a request to yourself only, marked [Test]
 *
 * For seeing the email as Sophie and Laraine receive it without emailing them
 * or posting to #tasks.
 */
const adminTestReleaseEmail = staffAdminProcedure
  .input(
    z.object({
      requestId: z.string().uuid(),
      event: z.enum(['submitted', 'accepted']).default('submitted'),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    await emailStaffOfRelease({ requestId: input.requestId, event: input.event, testTo: ctx.user.email });
    return { sentTo: ctx.user.email };
  });

export default adminTestReleaseEmail;
