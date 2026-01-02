import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partnerMembers, partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const inputSchema = z.object({
  userId: z.string().uuid(),
});

/**
 * Get all partner memberships for a user
 *
 * Returns both distributor and wine partner memberships.
 * A user can be linked to one distributor AND one wine partner.
 */
const usersGetPartnerMembership = adminProcedure
  .input(inputSchema)
  .query(async ({ input }) => {
    const { userId } = input;

    // Get all memberships for this user
    const memberships = await db
      .select({
        id: partnerMembers.id,
        partnerId: partnerMembers.partnerId,
        role: partnerMembers.role,
        partner: {
          id: partners.id,
          businessName: partners.businessName,
          type: partners.type,
        },
      })
      .from(partnerMembers)
      .innerJoin(partners, eq(partnerMembers.partnerId, partners.id))
      .where(eq(partnerMembers.userId, userId));

    // Also check for direct partner links (legacy)
    const directPartners = await db.query.partners.findMany({
      where: eq(partners.userId, userId),
      columns: {
        id: true,
        businessName: true,
        type: true,
      },
    });

    // Separate by type
    const distributorMembership = memberships.find(
      (m) => m.partner.type === 'distributor',
    );
    const winePartnerMembership = memberships.find(
      (m) => m.partner.type === 'wine_partner',
    );

    const directDistributor = directPartners.find((p) => p.type === 'distributor');
    const directWinePartner = directPartners.find((p) => p.type === 'wine_partner');

    return {
      distributor: distributorMembership
        ? { type: 'member' as const, membership: distributorMembership }
        : directDistributor
          ? { type: 'owner' as const, partner: directDistributor }
          : null,
      winePartner: winePartnerMembership
        ? { type: 'member' as const, membership: winePartnerMembership }
        : directWinePartner
          ? { type: 'owner' as const, partner: directWinePartner }
          : null,
    };
  });

export default usersGetPartnerMembership;
