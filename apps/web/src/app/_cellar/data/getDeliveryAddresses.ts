import { and, asc, desc, eq } from 'drizzle-orm';

import db from '@/database/client';
import { cellarDeliveryAddresses, partners } from '@/database/schema';

/**
 * A member's saved delivery addresses, default first
 *
 * `partners.deliveryAddress` is the truth for the default, because the profile
 * and admin screens write it directly. When the two disagree the partner record
 * wins and the default row is brought into line; when the member has an
 * address on their record and no saved rows, it becomes their first one.
 *
 * Guarded: if the table is not there yet, the member's one address on their
 * record is returned on its own, so requesting a delivery still works.
 *
 * @param partnerId - The member's partner record
 * @returns Saved addresses, default first, then by when they were added
 */
const getDeliveryAddresses = async (partnerId: string) => {
  const [partner] = await db
    .select({
      deliveryAddress: partners.deliveryAddress,
      deliveryInstructions: partners.deliveryInstructions,
    })
    .from(partners)
    .where(eq(partners.id, partnerId))
    .limit(1);

  const recordAddress = partner?.deliveryAddress?.trim() || null;
  const recordInstructions = partner?.deliveryInstructions?.trim() || null;

  const fallback = recordAddress
    ? [
        {
          id: null,
          label: 'Home',
          address: recordAddress,
          instructions: recordInstructions,
          isDefault: true,
        },
      ]
    : [];

  try {
    const read = () =>
      db
        .select({
          id: cellarDeliveryAddresses.id,
          label: cellarDeliveryAddresses.label,
          address: cellarDeliveryAddresses.address,
          instructions: cellarDeliveryAddresses.instructions,
          isDefault: cellarDeliveryAddresses.isDefault,
        })
        .from(cellarDeliveryAddresses)
        .where(eq(cellarDeliveryAddresses.partnerId, partnerId))
        .orderBy(
          desc(cellarDeliveryAddresses.isDefault),
          asc(cellarDeliveryAddresses.createdAt),
        );

    const rows = await read();
    const current = rows.find((row) => row.isDefault);

    if (recordAddress && !current) {
      await db.insert(cellarDeliveryAddresses).values({
        partnerId,
        label: 'Home',
        address: recordAddress,
        instructions: recordInstructions,
        isDefault: true,
      });

      return { addresses: await read() };
    }

    if (
      recordAddress &&
      current &&
      (current.address !== recordAddress ||
        (current.instructions ?? null) !== recordInstructions)
    ) {
      await db
        .update(cellarDeliveryAddresses)
        .set({
          address: recordAddress,
          instructions: recordInstructions,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(cellarDeliveryAddresses.id, current.id),
            eq(cellarDeliveryAddresses.partnerId, partnerId),
          ),
        );

      return { addresses: await read() };
    }

    return { addresses: rows };
  } catch (error) {
    console.error('Saved delivery addresses unavailable', { error, partnerId });

    return { addresses: fallback };
  }
};

export default getDeliveryAddresses;
