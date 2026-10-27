import { and, eq, inArray } from 'drizzle-orm';

import isTeamMember from '@/app/_teamTasks/utils/isTeamMember';
import db from '@/database/client';
import { partnerMembers } from '@/database/schema';

export type OrderParty = 'staff' | 'partner' | 'distributor';

export interface OrderPartyResult {
  /** Which side of the order the user acts for, or null for none */
  party: OrderParty | null;
  /**
   * Whether they may change anything: staff, or a partner member who is not
   * view-only
   */
  canWrite: boolean;
}

/**
 * Which party to an order a signed-in user acts for
 *
 * Staff are C&C admins (admin role and a C&C email address). Otherwise the
 * user's own memberships decide: of the order's wine partner, or of its
 * distributor. Every membership is checked, not just the first one found, so
 * someone in two partner accounts is judged by the one this order belongs to. A
 * colleague given view-only access can read but never change the order.
 *
 * @example
 *   const { party, canWrite } = await resolveOrderParty(user, order);
 *
 * @param user - The signed-in user
 * @param order - The order's wine partner and distributor
 * @returns The party and whether they may write
 */
const resolveOrderParty = async (
  user: { id: string; role: string; email: string; partnerId?: string | null },
  order: { partnerId: string | null; distributorId: string | null },
): Promise<OrderPartyResult> => {
  if (user.role === 'admin' && isTeamMember(user)) {
    return { party: 'staff', canWrite: true };
  }

  const orderPartnerIds = [order.partnerId, order.distributorId].filter(
    (id): id is string => !!id,
  );

  if (orderPartnerIds.length === 0) {
    return { party: null, canWrite: false };
  }

  const memberships = await db
    .select({ partnerId: partnerMembers.partnerId, role: partnerMembers.role })
    .from(partnerMembers)
    .where(
      and(
        eq(partnerMembers.userId, user.id),
        inArray(partnerMembers.partnerId, orderPartnerIds),
      ),
    );

  const roleFor = (partnerId: string | null) => {
    if (!partnerId) return null;
    const membership = memberships.find((m) => m.partnerId === partnerId);
    if (membership) return membership.role;
    // The legacy direct link on the user record has always meant the owner
    return user.partnerId === partnerId ? 'owner' : null;
  };

  const partnerRole = roleFor(order.partnerId);
  if (partnerRole) {
    return { party: 'partner', canWrite: partnerRole !== 'viewer' };
  }

  const distributorRole = roleFor(order.distributorId);
  if (distributorRole) {
    return { party: 'distributor', canWrite: distributorRole !== 'viewer' };
  }

  return { party: null, canWrite: false };
};

export default resolveOrderParty;
