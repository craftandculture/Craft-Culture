import { inArray } from 'drizzle-orm';

import db from '@/database/client';
import { cellarReleaseDeliveryDetails } from '@/database/schema';
import type { CellarReleaseDeliveryDetails } from '@/database/schema';

/**
 * How the member asked for each delivery to be made, keyed by request
 *
 * Guarded: a missing table returns an empty map, so the delivery screens show
 * what they always did rather than failing.
 *
 * @param requestIds - The release requests to look up
 * @returns Details by request id; requests without any are absent
 */
const getReleaseDeliveryDetails = async (requestIds: string[]) => {
  const byRequest = new Map<string, CellarReleaseDeliveryDetails>();

  if (requestIds.length === 0) return byRequest;

  try {
    const rows = await db
      .select()
      .from(cellarReleaseDeliveryDetails)
      .where(inArray(cellarReleaseDeliveryDetails.requestId, requestIds));

    for (const row of rows) byRequest.set(row.requestId, row);
  } catch (error) {
    console.error('Delivery details unavailable', { error });
  }

  return byRequest;
};

export default getReleaseDeliveryDetails;
