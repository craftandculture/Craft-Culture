import { desc, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import getUserOrRedirect from '@/app/_auth/data/getUserOrRedirect';
import db from '@/database';
import { organizations, organizationsMembers } from '@/database/schema';

export const GET = async () => {
  const user = await getUserOrRedirect();

  if (user.onboardingStep !== 'completed') {
    redirect('/onboarding');
  }

  const organizationsResult = await db
    .select({ slug: organizations.slug })
    .from(organizations)
    .innerJoin(
      organizationsMembers,
      eq(organizations.id, organizationsMembers.organizationId),
    )
    .where(eq(organizationsMembers.userId, user.id))
    .orderBy(desc(organizations.createdAt))
    .limit(1);

  if (organizationsResult.length === 0) {
    redirect('/');
  }

  redirect(`/${organizationsResult[0].slug}/overview`);
};
