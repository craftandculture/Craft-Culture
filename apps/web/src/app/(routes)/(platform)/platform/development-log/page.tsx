import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardDescription from '@/app/_ui/components/Card/CardDescription';
import CardProse from '@/app/_ui/components/Card/CardProse';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Typography from '@/app/_ui/components/Typography/Typography';
import parseChangelog from '@/utils/parseChangelog';
import type { ChangelogVersion } from '@/utils/parseChangelog';

/**
 * Format a date string to a more readable format
 *
 * @example
 *   formatDate('2025-10-25'); // returns 'October 25, 2025'
 *
 * @param dateString - ISO date string (YYYY-MM-DD)
 * @returns Formatted date string
 */
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Group changelog entries by type
 *
 * @param version - Changelog version object
 * @returns Grouped entries by type
 */
const groupEntriesByType = (version: ChangelogVersion) => {
  const features = version.entries.filter((entry) => entry.type === 'feature');
  const fixes = version.entries.filter((entry) => entry.type === 'fix');
  const other = version.entries.filter((entry) => entry.type === 'other');

  return { features, fixes, other };
};

const DevelopmentLogPage = () => {
  const versions = parseChangelog();

  return (
    <main className="container py-8 md:py-16">
      <Card className="mx-auto w-full max-w-4xl">
        <CardContent>
          <CardProse>
            <CardTitle>Development Log</CardTitle>
            <CardDescription colorRole="muted">
              Version history and feature updates
            </CardDescription>
          </CardProse>

          <div className="mt-8 max-h-[600px] space-y-8 overflow-y-auto pr-2">
            {versions.length === 0 ? (
              <Typography variant="bodySm" colorRole="muted">
                No version history available.
              </Typography>
            ) : (
              versions.map((version) => {
                const { features, fixes, other } = groupEntriesByType(version);

                return (
                  <div
                    key={version.version}
                    className="border-border-primary border-l-2 pl-4"
                  >
                    <div className="mb-2 flex items-baseline gap-3">
                      <Typography variant="headingMd" className="font-mono">
                        v{version.version}
                      </Typography>
                      <Typography variant="bodySm" colorRole="muted">
                        {formatDate(version.date)}
                      </Typography>
                    </div>

                    <div className="space-y-2">
                      {features.length > 0 && (
                        <div>
                          <Typography
                            variant="bodySm"
                            className="mb-1 font-semibold text-green-600 dark:text-green-400"
                          >
                            Features
                          </Typography>
                          <ul className="text-text-secondary ml-4 list-disc space-y-1 text-sm">
                            {features.map((entry, index) => (
                              <li key={index}>{entry.description}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {fixes.length > 0 && (
                        <div>
                          <Typography
                            variant="bodySm"
                            className="mb-1 font-semibold text-orange-600 dark:text-orange-400"
                          >
                            Bug Fixes
                          </Typography>
                          <ul className="text-text-secondary ml-4 list-disc space-y-1 text-sm">
                            {fixes.map((entry, index) => (
                              <li key={index}>{entry.description}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {other.length > 0 && (
                        <div>
                          <Typography
                            variant="bodySm"
                            className="mb-1 font-semibold text-blue-600 dark:text-blue-400"
                          >
                            Other Changes
                          </Typography>
                          <ul className="text-text-secondary ml-4 list-disc space-y-1 text-sm">
                            {other.map((entry, index) => (
                              <li key={index}>{entry.description}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default DevelopmentLogPage;
