import { TRPCError } from '@trpc/server';

import db from '@/database/client';
import { cellarReleaseDeliveryDetails } from '@/database/schema';

export interface ReleaseDeliveryDetailsInput {
  addressId?: string | null;
  addressLabel?: string | null;
  deliveryInstructions?: string | null;
  preferredDate?: string | null;
  preferredWindow?: 'morning' | 'afternoon' | 'any' | null;
  isGift?: boolean;
  recipientName?: string | null;
  recipientPhone?: string | null;
  giftMessage?: string | null;
}

/**
 * Record how the member would like a delivery made
 *
 * Replaces whatever the request held: the latest choice is the one that
 * stands. A failure is logged and swallowed for a preference, since the
 * delivery itself is already saved and a missing preferred day costs a phone
 * call. A gift is different — losing the recipient would send the wine to the
 * wrong person — so that failure is raised.
 *
 * @param requestId - The release request
 * @param details - The member's choices
 */
const saveReleaseDeliveryDetails = async (
  requestId: string,
  details: ReleaseDeliveryDetailsInput,
) => {
  const values = {
    addressId: details.addressId ?? null,
    addressLabel: details.addressLabel ?? null,
    deliveryInstructions: details.deliveryInstructions?.trim() || null,
    preferredDate: details.preferredDate ?? null,
    preferredWindow: details.preferredWindow ?? null,
    isGift: details.isGift === true,
    recipientName: details.isGift ? details.recipientName?.trim() || null : null,
    recipientPhone: details.isGift
      ? details.recipientPhone?.trim() || null
      : null,
    giftMessage: details.isGift ? details.giftMessage?.trim() || null : null,
    updatedAt: new Date(),
  };

  try {
    await db
      .insert(cellarReleaseDeliveryDetails)
      .values({ requestId, ...values })
      .onConflictDoUpdate({
        target: cellarReleaseDeliveryDetails.requestId,
        set: values,
      });
  } catch (error) {
    console.error('Could not save delivery details', { error, requestId });

    if (values.isGift) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message:
          'We could not save the recipient for this gift. Please try again, or contact us.',
      });
    }
  }
};

export default saveReleaseDeliveryDetails;
