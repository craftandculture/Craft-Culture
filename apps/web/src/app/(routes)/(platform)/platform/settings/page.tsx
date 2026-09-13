import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import Link from 'next/link';

import { resolveAccessProfile } from '@/app/_auth/constants/accessProfiles';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardDescription from '@/app/_ui/components/Card/CardDescription';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Divider from '@/app/_ui/components/Divider/Divider';
import Typography from '@/app/_ui/components/Typography/Typography';
import getQueryClient from '@/lib/react-query';
import api from '@/lib/trpc/server';
import tryCatch from '@/utils/tryCatch';

import CompanyProfileSection from './components/CompanyProfileSection';
import NotificationPreferencesSection from './components/NotificationPreferencesSection';
import PersonalDetailsSection from './components/PersonalDetailsSection';
import SecuritySection from './components/SecuritySection';

/**
 * Settings page for managing user profile and company information.
 *
 * What appears here depends on the account. A private collector raises no
 * quotes, so the company block that exists to put an address on a quote PDF is
 * not shown to them — and the details they do maintain live in their cellar,
 * which this page points at rather than duplicating.
 */
const SettingsPage = async () => {
  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(api.settings.get.queryOptions());

  const [user] = await tryCatch(
    queryClient.fetchQuery(api.users.getMe.queryOptions()),
  );

  const access = resolveAccessProfile({
    role: user?.role,
    customerType: user?.customerType,
    partnerType: user?.partner?.type,
  });

  const isCollector = access.kind === 'collector';

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="container py-4 landscape:py-2 md:py-16">
        <Card className="w-full">
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <CardTitle>Settings</CardTitle>
              <CardDescription>
                {isCollector
                  ? 'Manage how you sign in and what we tell you about'
                  : 'Manage your account and company preferences'}
              </CardDescription>
            </div>

            {isCollector ? (
              <div className="border-border-muted flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Delivery address and identification
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Kept with your cellar, alongside the wine they apply to
                  </Typography>
                </div>
                <Link href="/platform/cellar/profile">
                  <Button variant="outline" size="sm">
                    <ButtonContent>Your details</ButtonContent>
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                {/* Company Profile Section */}
                <CompanyProfileSection />

                <Divider />
              </>
            )}

            {/* Security Section (Passkeys, 2FA) */}
            <SecuritySection />

            <Divider />

            {/* Notification Preferences Section */}
            <NotificationPreferencesSection />

            {!isCollector && (
              <>
                <Divider />

                {/* Personal Details Section (B2C users only) */}
                <PersonalDetailsSection />
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </HydrationBoundary>
  );
};

export default SettingsPage;
