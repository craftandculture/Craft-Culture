import { ne } from 'drizzle-orm';

import getCellarStaffIds from '@/app/_cellar/data/getCellarStaffIds';
import getPartnerUserIds from '@/app/_cellar/data/getPartnerUserIds';
import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { cellarMemberships } from '@/database/schema';
import serverConfig from '@/server.config';

export type AllocationEvent =
  | 'opened'
  | 'interest'
  | 'allocated'
  | 'unallocated'
  | 'confirmed'
  | 'declined';

export interface NotifyAllocationUpdateParams {
  event: AllocationEvent;
  allocationId: string;
  wineName: string;
  /** The member concerned; not used when an offer opens to everyone */
  partnerId?: string;
  memberName?: string;
  cases?: number;
}

/**
 * Tell the right people an allocation has moved
 *
 * A new allocation goes to every member with a cellar; interest, confirmation
 * and decline go to the team; the share each member is given goes to that
 * member. Never throws.
 *
 * @param params - What happened, and for whom
 */
const notifyAllocationUpdate = async ({
  event,
  allocationId,
  wineName,
  partnerId,
  memberName,
  cases,
}: NotifyAllocationUpdateParams) => {
  try {
    let recipients: string[] = [];

    if (event === 'opened') {
      const members = await db
        .select({ partnerId: cellarMemberships.partnerId })
        .from(cellarMemberships)
        .where(ne(cellarMemberships.status, 'cancelled'));
      for (const member of members) {
        recipients.push(...(await getPartnerUserIds(member.partnerId)));
      }
    } else if (event === 'allocated' || event === 'unallocated') {
      recipients = partnerId ? await getPartnerUserIds(partnerId) : [];
    } else {
      recipients = await getCellarStaffIds();
    }

    recipients = [...new Set(recipients)];
    if (recipients.length === 0) return;

    const adminUrl = `${serverConfig.appUrl}/platform/admin/cellar-members?tab=requests`;
    const memberUrl = `${serverConfig.appUrl}/platform/cellar/available`;
    const share = cases
      ? `${cases} ${cases === 1 ? 'case' : 'cases'}`
      : 'your share';

    const content = {
      opened: {
        title: 'Offered to members first',
        message: `${wineName} is being offered to Private Cellar members before anyone else.`,
        actionUrl: memberUrl,
      },
      interest: {
        title: 'Interest in an allocation',
        message: `${memberName ?? 'A member'} would like ${share} of ${wineName}.`,
        actionUrl: adminUrl,
      },
      allocated: {
        title: 'Your allocation is ready',
        message: `We have set aside ${share} of ${wineName} for you. Please confirm to add it to your cellar.`,
        actionUrl: memberUrl,
      },
      unallocated: {
        title: `About ${wineName}`,
        message:
          'Demand was greater than the wine available, and we were not able to allocate any to you this time.',
        actionUrl: memberUrl,
      },
      confirmed: {
        title: 'A member confirmed an allocation',
        message: `${memberName ?? 'A member'} confirmed ${share} of ${wineName}.`,
        actionUrl: adminUrl,
      },
      declined: {
        title: 'A member declined an allocation',
        message: `${memberName ?? 'A member'} declined their allocation of ${wineName}.`,
        actionUrl: adminUrl,
      },
    }[event];

    for (const userId of recipients) {
      await createNotification({
        userId,
        type: 'cellar_allocation_update',
        title: content.title,
        message: content.message,
        entityType: 'cellar_allocation',
        entityId: allocationId,
        actionUrl: content.actionUrl,
        metadata: { event },
      });
    }
  } catch (error) {
    console.error('Failed to notify on allocation update', {
      allocationId,
      event,
      error,
    });
  }
};

export default notifyAllocationUpdate;
