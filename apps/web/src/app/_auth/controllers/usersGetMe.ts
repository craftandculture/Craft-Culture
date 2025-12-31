import db from '@/database/client';
import type { Partner, User } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

type PartnerInfo = Pick<Partner, 'id' | 'type' | 'businessName' | 'logoUrl' | 'brandColor'>;

interface UserWithPartner extends User {
  firstName: string | null;
  lastName: string | null;
  partner: PartnerInfo | null;
}

const usersGetMe = protectedProcedure.query(async ({ ctx }): Promise<UserWithPartner> => {
  // Get partner info if user has one
  let partner: PartnerInfo | null = null;

  if (ctx.user.customerType === 'private_clients') {
    const partnerResult = await db.query.partners.findFirst({
      where: { userId: ctx.user.id },
      columns: {
        id: true,
        type: true,
        businessName: true,
        logoUrl: true,
        brandColor: true,
      },
    });
    partner = partnerResult ?? null;
  }

  return {
    ...ctx.user,
    partner,
  };
});

export default usersGetMe;
