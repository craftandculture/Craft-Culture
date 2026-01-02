import Link from 'next/link';
import { redirect } from 'next/navigation';

import UserDropdown from '@/app/_auth/components/UserDropdown';
import NotificationBell from '@/app/_notifications/components/NotificationBell';
import BrandedTitleProvider from '@/app/_ui/components/BrandedTitleProvider/BrandedTitleProvider';
import CommandBar from '@/app/_ui/components/CommandBar/CommandBar';
import BrandedFooter from '@/app/_ui/components/Footer/BrandedFooter';
import BrandedLogo from '@/app/_ui/components/Logo/BrandedLogo';
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
      <BrandedTitleProvider customerType={user.customerType} />
      <CommandBar />
      <header className="border-border-primary sticky top-0 z-50 border-b bg-background-primary/80 backdrop-blur-xl">
        <div className="container flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link
              href="/platform/quotes"
              className="transition-opacity duration-200 hover:opacity-80"
            >
              <BrandedLogo customerType={user.customerType} height={144} />
            </Link>
            <nav className="hidden items-center gap-2 md:flex">
              {/* Quotes section */}
              <div className="flex items-center rounded-lg border border-border-muted/50 px-1.5 py-1">
                <span className="border-r border-border-muted/50 pr-2 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                  Quotes
                </span>
                <Link
                  href="/platform/quotes"
                  className="text-text-primary hover:bg-fill-muted ml-1 rounded-md px-2.5 py-1 text-sm font-medium transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
                >
                  Create
                </Link>
                <span className="text-border-muted">|</span>
                <Link
                  href="/platform/my-quotes"
                  className="text-text-primary hover:bg-fill-muted rounded-md px-2.5 py-1 text-sm font-medium transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
                >
                  My Quotes
                </Link>
                {user.role === 'admin' && (
                  <>
                    <span className="text-border-muted">|</span>
                    <Link
                      href="/platform/admin/quote-approvals"
                      className="text-text-primary hover:bg-fill-muted rounded-md px-2.5 py-1 text-sm font-medium transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
                    >
                      Approvals
                    </Link>
                  </>
                )}
              </div>
              {/* Private Clients section - for Wine Partners */}
              {user.customerType === 'private_clients' && user.partner?.type === 'wine_partner' && (
                <>
                  <div className="flex items-center rounded-lg border border-border-muted/50 bg-surface-secondary/40 px-1.5 py-1">
                    <span className="border-r border-border-muted/50 pr-2 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                      Private Clients
                    </span>
                    <Link
                      href="/platform/private-orders"
                      className="text-text-primary hover:bg-fill-muted ml-1 rounded-md px-2.5 py-1 text-sm font-medium transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
                    >
                      My Orders
                    </Link>
                  </div>
                  <div className="flex items-center rounded-lg border border-border-muted/50 bg-surface-secondary/40 px-1.5 py-1">
                    <span className="border-r border-border-muted/50 pr-2 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                      CRM
                    </span>
                    <Link
                      href="/platform/clients"
                      className="text-text-primary hover:bg-fill-muted ml-1 rounded-md px-2.5 py-1 text-sm font-medium transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
                    >
                      Clients
                    </Link>
                  </div>
                </>
              )}
              {/* Distributor section - for B2B users and distributor partners */}
              {(user.customerType === 'b2b' || user.partner?.type === 'distributor') && (
                <div className="flex items-center rounded-lg border border-border-muted/50 bg-surface-secondary/40 px-1.5 py-1">
                  <span className="border-r border-border-muted/50 pr-2 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                    Private Clients
                  </span>
                  <Link
                    href="/platform/distributor"
                    className="text-text-primary hover:bg-fill-muted ml-1 rounded-md px-2.5 py-1 text-sm font-medium transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
                  >
                    Dashboard
                  </Link>
                  <span className="text-border-muted">|</span>
                  <Link
                    href="/platform/distributor/orders"
                    className="text-text-primary hover:bg-fill-muted rounded-md px-2.5 py-1 text-sm font-medium transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
                  >
                    Assigned Orders
                  </Link>
                </div>
              )}
              {/* Admin sections */}
              {user.role === 'admin' && (
                <>
                  {/* Private Orders - admin management */}
                  <div className="flex items-center rounded-lg border border-border-muted/50 bg-surface-secondary/40 px-1.5 py-1">
                    <span className="border-r border-border-muted/50 pr-2 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                      Private Orders
                    </span>
                    <Link
                      href="/platform/admin"
                      className="text-text-primary hover:bg-fill-muted ml-1 rounded-md px-2.5 py-1 text-sm font-medium transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
                    >
                      Dashboard
                    </Link>
                    <span className="text-border-muted">|</span>
                    <Link
                      href="/platform/admin/private-orders"
                      className="text-text-primary hover:bg-fill-muted rounded-md px-2.5 py-1 text-sm font-medium transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
                    >
                      Manage
                    </Link>
                  </div>
                  {/* Pricing section */}
                  <div className="flex items-center rounded-lg border border-border-muted/50 bg-surface-secondary/40 px-1.5 py-1">
                    <span className="border-r border-border-muted/50 pr-2 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                      Pricing
                    </span>
                    <Link
                      href="/platform/admin/pricing-calculator"
                      className="text-text-primary hover:bg-fill-muted ml-1 rounded-md px-2.5 py-1 text-sm font-medium transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
                    >
                      Calculator
                    </Link>
                  </div>
                </>
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
      <BrandedFooter customerType={user.customerType} />
    </div>
  );
};

export default PlatformLayout;
