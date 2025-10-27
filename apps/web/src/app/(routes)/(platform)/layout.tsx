import Link from 'next/link';
import { redirect } from 'next/navigation';

import ActivityBell from '@/app/_admin/components/ActivityBell';
import UserDropdown from '@/app/_auth/components/UserDropdown';
import Footer from '@/app/_ui/components/Footer/Footer';
import Logo from '@/app/_ui/components/Logo/Logo';
import ThemeToggle from '@/app/_ui/components/ThemeToggle/ThemeToggle';
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
    <div className="bg-background-primary flex min-h-dvh flex-col">
      <header className="container flex h-14 items-center justify-between gap-4">
        <Link href="/platform">
          <Logo height={24} />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          {user.role === 'admin' && <ActivityBell />}
          <ThemeToggle />
          <UserDropdown user={user} />
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
};

export default PlatformLayout;
