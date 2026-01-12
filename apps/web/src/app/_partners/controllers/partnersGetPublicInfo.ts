import { eq } from 'drizzle-orm';
import z from 'zod';

import db from '@/database/client';
import { partners } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

/**
 * Get public display info for a partner
 *
 * Used by clients to display partner branding on quotes.
 * Only returns non-sensitive information suitable for public display.
 */
const partnersGetPublicInfo = protectedProcedure
  .input(z.object({ partnerId: z.string().uuid() }))
  .query(async ({ input }: { input: { partnerId: string } }) => {
    const { partnerId } = input;

    const [partner] = await db
      .select({
        id: partners.id,
        businessName: partners.businessName,
        logoUrl: partners.logoUrl,
      })
      .from(partners)
      .where(eq(partners.id, partnerId));

    if (!partner) {
      return null;
    }

    return partner;
  });

export default partnersGetPublicInfo;
