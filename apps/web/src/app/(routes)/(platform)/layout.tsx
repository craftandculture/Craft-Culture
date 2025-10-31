import Link from 'next/link';
import { redirect } from 'next/navigation';

import PendingUsersBell from '@/app/_admin/components/PendingUsersBell';
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

  // Check approval status first - pending users shouldn't see onboarding
  if (user.approvalStatus !== 'approved') {
    redirect('/pending-approval');
  }

  if (user.onboardingCompletedAt === null) {
    redirect('/welcome');
  }

  return (
    <div className="bg-background-primary flex min-h-dvh flex-col">
      <header className="border-border-primary border-b">
        <div className="container flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/platform/quotes">
              <Logo height={144} />
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              <Link
                href="/platform/quotes"
                className="text-text-primary hover:bg-fill-secondary rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
              >
                Create Quote
              </Link>
              <Link
                href="/platform/my-quotes"
                className="text-text-primary hover:bg-fill-secondary rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
              >
                My Quotes
              </Link>
              {user.role === 'admin' && (
                <Link
                  href="/platform/admin/quote-approvals"
                  className="text-text-primary hover:bg-fill-secondary rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
                >
                  Quote Approvals
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {user.role === 'admin' && <PendingUsersBell />}
            <ThemeToggle />
            <UserDropdown user={user} />
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
};

export default PlatformLayout;
