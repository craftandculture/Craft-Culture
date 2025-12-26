import { IconHistory } from '@tabler/icons-react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import parseChangelog from '@/utils/parseChangelog';

import VersionEntry from './VersionEntry';

const DevelopmentLogPage = () => {
  const versions = parseChangelog();

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
              {versions.length} releases
            </Typography>
          </div>
        </div>

        {/* Version List */}
        <div className="rounded-xl border border-border-primary bg-fill-primary">
          {versions.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Typography variant="bodySm" colorRole="muted">
                No version history available.
              </Typography>
            </div>
          ) : (
            <div className="divide-y divide-border-primary">
              {versions.slice(0, 20).map((version, index) => (
                <VersionEntry
                  key={version.version}
                  version={version}
                  isLatest={index === 0}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer note */}
        {versions.length > 20 && (
          <Typography
            variant="bodyXs"
            colorRole="muted"
            className="mt-3 text-center"
          >
            Showing latest 20 releases
          </Typography>
        )}
      </div>
    </main>
  );
};

export default DevelopmentLogPage;
