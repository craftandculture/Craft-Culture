import { IconHistory } from '@tabler/icons-react';
import { redirect } from 'next/navigation';

import getUserOrRedirect from '@/app/_auth/data/getUserOrRedirect';
import isTeamMember from '@/app/_teamTasks/utils/isTeamMember';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import groupChangelogByDay from '@/utils/groupChangelogByDay';
import parseChangelog from '@/utils/parseChangelog';

import DayEntry from './DayEntry';

const DAYS_SHOWN = 14;

/**
 * Internal release history. The changelog names partners and pricing work, so
 * it is for the C&C team only.
 */
const DevelopmentLogPage = async () => {
  const user = await getUserOrRedirect();

  if (!isTeamMember(user)) {
    redirect('/platform');
  }

  const versions = parseChangelog();
  const days = groupChangelogByDay(versions);

  return (
    <main className="container py-6 md:py-10">
      <div className="mx-auto w-full max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fill-secondary">
            <Icon icon={IconHistory} size="md" colorRole="muted" />
          </div>
          <div>
            <Typography variant="headingMd">Development Log</Typography>
            <Typography variant="bodyXs" colorRole="muted">
              {versions[0] ? `v${versions[0].version} · ` : ''}
              {versions.length} releases
            </Typography>
          </div>
        </div>

        {/* Version List */}
        <div className="overflow-hidden rounded-xl border border-border-primary bg-fill-primary">
          {days.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Typography variant="bodySm" colorRole="muted">
                No version history available.
              </Typography>
            </div>
          ) : (
            <div className="divide-y divide-border-primary">
              {days.slice(0, DAYS_SHOWN).map((day, index) => (
                <DayEntry key={day.date} day={day} isLatest={index === 0} />
              ))}
            </div>
          )}
        </div>

        {/* Footer note */}
        {days.length > DAYS_SHOWN && (
          <Typography
            variant="bodyXs"
            colorRole="muted"
            className="mt-3 text-center"
          >
            Showing the last {DAYS_SHOWN} days of releases
          </Typography>
        )}
      </div>
    </main>
  );
};

export default DevelopmentLogPage;
