import { TRPCError } from '@trpc/server';

import placeCellarPurchase from '@/app/_consignment/data/placeCellarPurchase';
import logger from '@/utils/logger';

import openSourcingTask from './openSourcingTask';

export interface FulfilAgreedWineParams {
  partnerId: string;
  partnerName: string;
  userId: string;
  /** SRC-2026-0003, or the allocation's wine, for the job title */
  reference: string;
  lwin18: string | null;
  wineName: string;
  cases: number;
  caseConfig: number;
  pricePerBottleUsd: number;
  holdAt: string;
  fromStock: boolean;
  linkUrl: string;
}

/**
 * Turn a wine a member has agreed to into a purchase, or a job to buy it
 *
 * Wine already in our UAE warehouse is reserved at once through the same path
 * as Available now, at the price we offered, so it appears in the member's
 * Purchases with how to pay. Anything else (UK, en primeur, not yet bought, or
 * stock that has since gone) becomes a Team Tasks job, and we invoice by hand.
 *
 * @param params - The member, the wine and the agreed price
 * @returns The purchase or job that now carries it
 */
const fulfilAgreedWine = async (params: FulfilAgreedWineParams) => {
  if (params.fromStock && params.holdAt === 'uae' && params.lwin18) {
    try {
      const purchase = await placeCellarPurchase({
        partnerId: params.partnerId,
        partnerName: params.partnerName,
        userId: params.userId,
        priced: [
          {
            lwin18: params.lwin18,
            cases: params.cases,
            product: params.wineName,
            pricePerBottleUsd: params.pricePerBottleUsd,
          },
        ],
        notes: `Agreed under ${params.reference}`,
      });

      return { purchase, taskId: null };
    } catch (error) {
      /*
        The stock may have sold, or never been released to the pool. The
        member has still agreed, so the team takes it from here rather than
        the member seeing an error for something they cannot fix.
      */
      if (!(error instanceof TRPCError)) throw error;
      logger.error('Agreed wine could not be reserved from stock', {
        reference: params.reference,
        message: error.message,
      });
    }
  }

  const bottles = params.cases * params.caseConfig;
  const where =
    params.holdAt === 'uk'
      ? 'London City Bond, Burton'
      : 'our UAE bonded warehouse';

  const taskId = await openSourcingTask({
    title: `${params.partnerName}: buy ${params.wineName} (${params.reference})`,
    what: `${params.partnerName} has agreed to ${params.cases} × ${params.caseConfig} (${bottles} bottles) of ${params.wineName} at $${params.pricePerBottleUsd.toFixed(2)} a bottle, held at ${where}. Buy or reserve it, invoice the member, and add it to their cellar once paid.`,
    memberName: params.partnerName,
    linkUrl: params.linkUrl,
  });

  return { purchase: null, taskId };
};

export default fulfilAgreedWine;
