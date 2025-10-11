import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { sql } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

import getUserOrRedirect from '@/app/_auth/data/getUserOrRedirect';
import InviteCard from '@/app/_team-invites/components/InviteCard';
import Logo from '@/app/_ui/components/Logo/Logo';
import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';
import db from '@/database';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';

export const dynamic = 'force-dynamic';

const Page = async (props: { params: Promise<{ code: string }> }) => {
  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(api.organizations.getAll.queryOptions());

  const params = await props.params;

  const { code } = params;

  const [invite, user] = await Promise.all([
    db.query.invites.findFirst({
      where: {
        RAW: (table) => sql`LOWER(${table.code}) = LOWER(${code})`,
        status: 'pending',
      },
      with: {
        organization: {
          with: {
            organizationsMembers: true,
          },
        },
        user: true,
      },
    }),
    getUserOrRedirect(),
  ]);

  if (
    invite?.organization.organizationsMembers.some(
      (member) => member.userId === user.id,
    )
  ) {
    redirect(`/${invite.organization.slug}`);
  }

  if (!invite) {
    notFound();
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="container mx-auto flex w-full flex-col items-center gap-8">
        <Logo className="h-6" />
        <Suspense fallback={<Skeleton className="h-[284px] w-full max-w-lg" />}>
          <InviteCard
            profileName={invite.user.name}
            organizationName={invite.organization.name}
            inviteId={invite.id}
          />
        </Suspense>
      </div>
    </HydrationBoundary>
  );
};

export default Page;
