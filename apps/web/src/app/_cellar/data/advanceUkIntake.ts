import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import wineSources from '@/app/_onboarding/constants/wineSources';
import db from '@/database/client';
import { cellarIntakes } from '@/database/schema';

// Transfers that arrive through our UK bond; wine already in the UAE never passes LCB
const TRANSFER_SOURCES = wineSources
  .filter((source) => source.isTransfer && source.value !== 'uae_bond')
  .map((source) => source.value as string);

/**
 * Move a member's waiting transfer on to "Arrived at our UK bond"
 *
 * Called when wine at LCB is placed in their cellar. Only the oldest transfer
 * still waiting moves, and only one not already following a UAE shipment: a
 * member with two transfers outstanding sees one arrive per rotation, which
 * is as much as a rotation can say. The stage is moved quietly — the member is
 * told about the wine itself, and two notices for one arrival is one too many.
 *
 * @param partnerId - The member the wine was placed with
 */
const advanceUkIntake = async (partnerId: string) => {
  const [waiting] = await db
    .select({ id: cellarIntakes.id })
    .from(cellarIntakes)
    .where(
      and(
        eq(cellarIntakes.partnerId, partnerId),
        inArray(cellarIntakes.stage, ['requested', 'in_progress']),
        inArray(cellarIntakes.source, TRANSFER_SOURCES),
        isNull(cellarIntakes.shipmentId),
      ),
    )
    .orderBy(asc(cellarIntakes.createdAt))
    .limit(1);

  if (!waiting) return;

  await db
    .update(cellarIntakes)
    .set({ stage: 'arriving_uk', updatedAt: new Date() })
    .where(
      and(
        eq(cellarIntakes.id, waiting.id),
        inArray(cellarIntakes.stage, ['requested', 'in_progress']),
      ),
    );
};

export default advanceUkIntake;
