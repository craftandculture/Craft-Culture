import Link from 'next/link';
import { redirect } from 'next/navigation';

import UserDropdown from '@/app/_auth/components/UserDropdown';
import Logo from '@/app/_ui/components/Logo/Logo';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';
import tryCatch from '@/utils/tryCatch';

export const dynamic = 'force-dynamic';

const PlatformLayout = async ({ children }: React.PropsWithChildren) => {
  const queryClient = getQueryClient();

  const [user, userError] = await tryCatch(
    queryClient.fetchQuery(api.users.getMe.queryOptions()),
  );

  if (userError) {
    redirect('/sign-in?next=/platform');
  }

  if (user.onboardingCompletedAt === null) {
    redirect('/welcome');
  }

  return (
    <div className="bg-background-primary h-dvh min-h-dvh">
      <header className="container flex h-14 items-center justify-between">
        <Link href="/platform">
          <Logo height={24} />
        </Link>
        <UserDropdown user={user} />
      </header>
      {children}
    </div>
  );
};

export default PlatformLayout;
