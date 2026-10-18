import Link from 'next/link';

import getUserOrRedirect from '@/app/_auth/data/getUserOrRedirect';
import NotificationFeed from '@/app/_notifications/components/NotificationFeed';
import Typography from '@/app/_ui/components/Typography/Typography';

/**
 * Every notification for the signed-in account
 *
 * The same filtered list as the drawer behind the bell, with room for the
 * full history. Open to every account type.
 */
const NotificationsPage = async () => {
  await getUserOrRedirect();

  return (
    <main className="container max-w-3xl space-y-5 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Typography variant="headingLg" asChild>
            <h1>Notifications</h1>
          </Typography>
          <Typography variant="bodySm" colorRole="muted" asChild>
            <p className="mt-1">
              What needs your attention first, then everything else by day.
            </p>
          </Typography>
        </div>
        <Link
          href="/platform/settings"
          className="text-sm font-medium text-text-muted hover:text-text-primary"
        >
          Notification settings
        </Link>
      </div>
      <div className="flex h-[calc(100vh-220px)] min-h-[480px] flex-col overflow-hidden rounded-xl border border-border-muted bg-surface-primary pt-4">
        <NotificationFeed variant="page" />
      </div>
    </main>
  );
};

export default NotificationsPage;
