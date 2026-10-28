import type { Metadata, Viewport } from 'next';
import { redirect } from 'next/navigation';

import { resolveAccessProfile } from '@/app/_auth/constants/accessProfiles';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';
import tryCatch from '@/utils/tryCatch';

import CellarTabs from './CellarTabs';

export const metadata: Metadata = {
  title: 'Your cellar',
  /* Behind a login, and about a named individual's holdings either way. */
  robots: { index: false, follow: false },
  /*
    Members can add the cellar to their home screen and open it like an app.
    The manifest is set here rather than site-wide, so staff screens never
    offer to install themselves as "C&C Cellar".
  */
  manifest: '/cellar.webmanifest',
  appleWebApp: { capable: true, title: 'C&C Cellar', statusBarStyle: 'default' },
  icons: { apple: '/images/cellar-apple-touch-icon.png' },
};

export const viewport: Viewport = {
  themeColor: '#F6F7F5',
  viewportFit: 'cover',
};

/**
 * The cellar is for accounts that hold wine with us
 *
 * Anyone else is sent to their own home rather than shown an empty page:
 * a screen that renders nothing reads as a fault, not as a boundary.
 */
const CellarLayout = async ({ children }: React.PropsWithChildren) => {
  const queryClient = getQueryClient();

  const [user, userError] = await tryCatch(
    queryClient.fetchQuery(api.users.getMe.queryOptions()),
  );

  if (userError) {
    redirect('/sign-in?next=/platform/cellar');
  }

  const access = resolveAccessProfile({
    role: user.role,
    customerType: user.customerType,
    partnerType: user.partner?.type,
  });

  if (!access.can.ownsStock) {
    redirect(access.home);
  }

  /*
    The tabs live here rather than on each page, so a member never lands
    somewhere that has lost its own navigation. The home-screen and Face ID
    suggestions are not here: they sit beneath the wine on Your cellar, and
    on Your details.
  */
  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 pt-6 pb-28 sm:px-6 sm:pt-8 md:pb-0">
      <CellarTabs />
      {children}
    </div>
  );
};

export default CellarLayout;
