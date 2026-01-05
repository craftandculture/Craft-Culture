import { TRPCError } from '@trpc/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  adminActivityLogs,
  partnerMembers,
  partners,
  sessions,
  users,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const inputSchema = z.object({
  userId: z.string().uuid(),
});

/**
 * Admin endpoint to get detailed information about a single user
 *
 * Returns comprehensive user data including:
 * - Basic profile info
 * - Partner memberships (distributor and wine partner)
 * - Recent activity logs
 * - Active sessions
 */
const usersAdminGetOne = adminProcedure
  .input(inputSchema)
  .query(async ({ input }) => {
    const { userId } = input;

    // Get the user with all fields
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    // Get partner memberships
    const memberships = await db
      .select({
        id: partnerMembers.id,
        role: partnerMembers.role,
        partnerId: partnerMembers.partnerId,
        partnerName: partners.businessName,
        partnerType: partners.type,
        joinedAt: partnerMembers.createdAt,
      })
      .from(partnerMembers)
      .innerJoin(partners, eq(partnerMembers.partnerId, partners.id))
      .where(eq(partnerMembers.userId, userId));

    // Get the user's own partner (if they're an owner)
    const [ownedPartner] = await db
      .select({
        id: partners.id,
        businessName: partners.businessName,
        type: partners.type,
      })
      .from(partners)
      .where(eq(partners.userId, userId))
      .limit(1);

    // Categorize memberships
    const distributorMembership = memberships.find(
      (m) => m.partnerType === 'distributor',
    );
    const winePartnerMembership = memberships.find(
      (m) => m.partnerType === 'wine_partner',
    );

    // Get recent activity logs (admin actions on this user)
    const recentActivity = await db
      .select({
        id: adminActivityLogs.id,
        action: adminActivityLogs.action,
        metadata: adminActivityLogs.metadata,
        createdAt: adminActivityLogs.createdAt,
        adminId: adminActivityLogs.adminId,
        adminName: users.name,
      })
      .from(adminActivityLogs)
      .leftJoin(users, eq(adminActivityLogs.adminId, users.id))
      .where(eq(adminActivityLogs.entityId, userId))
      .orderBy(desc(adminActivityLogs.createdAt))
      .limit(20);

    // Get active sessions
    const activeSessions = await db
      .select({
        id: sessions.id,
        createdAt: sessions.createdAt,
        expiresAt: sessions.expiresAt,
        userAgent: sessions.userAgent,
        ipAddress: sessions.ipAddress,
      })
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.createdAt))
      .limit(10);

    // Get who approved this user (if approved)
    let approvedByUser = null;
    if (user.approvedBy) {
      const [approver] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, user.approvedBy))
        .limit(1);
      approvedByUser = approver;
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        customerType: user.customerType,
        approvalStatus: user.approvalStatus,
        approvedAt: user.approvedAt,
        approvedBy: approvedByUser,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        onboardingCompletedAt: user.onboardingCompletedAt,
        termsAcceptedAt: user.termsAcceptedAt,
        // Company info (B2B)
        companyName: user.companyName,
        companyAddress: user.companyAddress,
        companyPhone: user.companyPhone,
        companyEmail: user.companyEmail,
        companyWebsite: user.companyWebsite,
        companyVatNumber: user.companyVatNumber,
        companyLogo: user.companyLogo,
        isRetailPartner: user.isRetailPartner,
        // Address (B2C)
        phone: user.phone,
        addressLine1: user.addressLine1,
        addressLine2: user.addressLine2,
        city: user.city,
        stateProvince: user.stateProvince,
        postalCode: user.postalCode,
        country: user.country,
        // Bank details
        bankDetails: user.bankDetails,
      },
      partners: {
        owned: ownedPartner ?? null,
        distributor: distributorMembership
          ? {
              id: distributorMembership.partnerId,
              name: distributorMembership.partnerName,
              role: distributorMembership.role,
              joinedAt: distributorMembership.joinedAt,
            }
          : null,
        winePartner: winePartnerMembership
          ? {
              id: winePartnerMembership.partnerId,
              name: winePartnerMembership.partnerName,
              role: winePartnerMembership.role,
              joinedAt: winePartnerMembership.joinedAt,
            }
          : null,
      },
      recentActivity,
      activeSessions,
    };
  });

export default usersAdminGetOne;
