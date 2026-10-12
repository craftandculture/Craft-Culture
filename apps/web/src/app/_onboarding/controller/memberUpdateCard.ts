import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { cellarMemberships } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';
import { createUpdateCardHostedPage } from '@/lib/zoho/billing';
import serverConfig from '@/server.config';

/** Zoho's page to replace the card on file, after a payment fails */
const memberUpdateCard = stockOwnerProcedure.mutation(async ({ ctx }) => {
  const [membership] = await db
    .select()
    .from(cellarMemberships)
    .where(eq(cellarMemberships.partnerId, ctx.partner.id))
    .limit(1);

  if (!membership?.zohoSubscriptionId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'There is no membership card on file yet.' });
  }

  const page = await createUpdateCardHostedPage({
    subscriptionId: membership.zohoSubscriptionId,
    redirectUrl: `${serverConfig.appUrl}/platform/cellar/activated?card=1`,
  });

  return { url: page.url };
});

export default memberUpdateCard;
