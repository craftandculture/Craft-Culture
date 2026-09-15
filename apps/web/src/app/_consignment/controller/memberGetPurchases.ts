import { desc, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { cellarPurchaseItems, cellarPurchases } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

/**
 * What a member has bought, and where each purchase has got to
 *
 * The seller is never returned. A buyer is buying from C&C, which is what is
 * legally happening, and whose parcel it was is nobody else's business — the
 * same rule the catalogue follows.
 */
const memberGetPurchases = stockOwnerProcedure.query(async ({ ctx }) => {
  const purchases = await db
    .select()
    .from(cellarPurchases)
    .where(eq(cellarPurchases.buyerPartnerId, ctx.partner.id))
    .orderBy(desc(cellarPurchases.createdAt))
    .limit(100);

  if (purchases.length === 0) return { purchases: [] };

  const items = await db
    .select({
      id: cellarPurchaseItems.id,
      purchaseId: cellarPurchaseItems.purchaseId,
      productName: cellarPurchaseItems.productName,
      producer: cellarPurchaseItems.producer,
      vintage: cellarPurchaseItems.vintage,
      bottleSize: cellarPurchaseItems.bottleSize,
      caseConfig: cellarPurchaseItems.caseConfig,
      cases: cellarPurchaseItems.cases,
      bottles: cellarPurchaseItems.bottles,
      pricePerBottleUsd: cellarPurchaseItems.pricePerBottleUsd,
      lineTotalUsd: cellarPurchaseItems.lineTotalUsd,
    })
    .from(cellarPurchaseItems)
    /*
      Scoped to this member's own purchases. Without the filter this read every
      purchase line in the system and leaned on the Map lookup below to show
      only the right ones — so the rows never rendered, but they were fetched,
      and the query grew with everybody else's buying.
    */
    .where(
      inArray(
        cellarPurchaseItems.purchaseId,
        purchases.map((purchase) => purchase.id),
      ),
    );

  const byPurchase = new Map<string, typeof items>();

  for (const item of items) {
    byPurchase.set(item.purchaseId, [
      ...(byPurchase.get(item.purchaseId) ?? []),
      item,
    ]);
  }

  return {
    purchases: purchases.map((purchase) => ({
      id: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      status: purchase.status,
      totalUsd: purchase.totalUsd,
      reservedUntil: purchase.reservedUntil,
      paymentClaimedAt: purchase.paymentClaimedAt,
      completedAt: purchase.completedAt,
      createdAt: purchase.createdAt,
      items: byPurchase.get(purchase.id) ?? [],
    })),
  };
});

export default memberGetPurchases;
