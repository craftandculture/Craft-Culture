import Link from 'next/link';
import { redirect } from 'next/navigation';

import UserDropdown from '@/app/_auth/components/UserDropdown';
import NotificationBell from '@/app/_notifications/components/NotificationBell';
import CommandBar from '@/app/_ui/components/CommandBar/CommandBar';
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
      <CommandBar />
      <header className="border-border-primary sticky top-0 z-50 border-b bg-background-primary/80 backdrop-blur-xl">
        <div className="container flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link
              href="/platform/quotes"
              className="transition-opacity duration-200 hover:opacity-80"
            >
              <Logo height={144} />
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              <Link
                href="/platform/quotes"
                className="text-text-primary hover:bg-fill-muted rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:shadow-sm active:scale-[0.98]"
              >
                Create Quote
              </Link>
              <Link
                href="/platform/my-quotes"
                className="text-text-primary hover:bg-fill-muted rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:shadow-sm active:scale-[0.98]"
              >
                My Quotes
              </Link>
              {user.role === 'admin' && (
                <Link
                  href="/platform/admin/quote-approvals"
                  className="text-text-primary hover:bg-fill-muted rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:shadow-sm active:scale-[0.98]"
                >
                  Quote Approvals
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationBell />
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
