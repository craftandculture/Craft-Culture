import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { SHIPMENT_MILESTONES } from '@/app/_logistics/utils/buildShipmentPartnerEmail';
import { adminProcedure } from '@/lib/trpc/procedures';

import announceShipment from '../data/announceShipment';

/**
 * Admin only: post an inbound shipment to #warehouse-activity again, e.g. one
 * received before the feed existed, or when a post went missing
 *
 * @example
 *   await trpcClient.wms.admin.receiving.resendPost.mutate({ shipmentId, milestone: 'received' });
 */
const adminResendShipmentPost = adminProcedure
  .input(z.object({ shipmentId: z.string().uuid(), milestone: z.enum(SHIPMENT_MILESTONES) }))
  .mutation(async ({ input }) => {
    const problem = await announceShipment(input.shipmentId, input.milestone, { force: true });
    if (problem) throw new TRPCError({ code: 'BAD_REQUEST', message: `The post did not go: ${problem}` });
    return { posted: true };
  });

export default adminResendShipmentPost;
