import { TRPCError } from '@trpc/server';

import sendDailySalesReport from '../data/sendDailySalesReport';
import staffProcedure from '../utils/staffProcedure';

/**
 * Post the daily sales message to Slack now
 *
 * The button beside the scheduled 07:00 post, for checking the channel is wired
 * up or resending after a missed morning. Pulls a fresh position first, the
 * same as the schedule does.
 */
const staffSendDailySales = staffProcedure.mutation(async () => {
  try {
    return await sendDailySalesReport();
  } catch (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Posting to Slack failed',
    });
  }
});

export default staffSendDailySales;
