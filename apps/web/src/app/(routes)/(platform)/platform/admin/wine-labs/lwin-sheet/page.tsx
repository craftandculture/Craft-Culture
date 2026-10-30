import { redirect } from 'next/navigation';

import AdminPageHeader from '@/app/_admin/components/AdminPageHeader';
import getUserOrRedirect from '@/app/_auth/data/getUserOrRedirect';
import isStaff from '@/app/_distribution/utils/isStaff';
import LwinSheetMatcher from '@/app/_winelabs/components/LwinSheetMatcher';
import getWinelabsCreditsThisMonth from '@/lib/winelabs/getWinelabsCreditsThisMonth';
import isWinelabsConfigured from '@/lib/winelabs/isWinelabsConfigured';

export const dynamic = 'force-dynamic';
// Each call matches up to 12 lines, four at a time
export const maxDuration = 120;

/**
 * LWIN from a spreadsheet — upload a list of wines, download it with LWINs
 *
 * Any supplier list, offer or client cellar list: each line is matched by Wine
 * Labs with our LWIN register behind it, under the same rules as inbound
 * shipments. Nothing is written to our records. C&C staff only.
 */
const LwinSheetPage = async () => {
  const user = await getUserOrRedirect();
  if (!isStaff(user)) redirect('/platform');

  const [configured, credits] = await Promise.all([isWinelabsConfigured(), getWinelabsCreditsThisMonth()]);

  return (
    <main className="container max-w-5xl space-y-6 py-8">
      <AdminPageHeader
        title="LWIN from a spreadsheet"
        description={
          <>
            Upload a list of wines (a supplier offer, a cellar list, an order) and download the same sheet with LWIN
            codes added on the right. Each wine is matched by Wine Labs first, with our LWIN register behind it, by
            the rules used for inbound shipments: a code is filled only when the match names the wine and its
            producer. Otherwise Wine Labs&apos; suggestion is given in its own columns for you to check. LWIN11 is
            filled when the vintage is known, LWIN18 when the pack is too. Nothing here changes our records.
          </>
        }
      />
      {!configured && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          Wine Labs is not connected.
        </p>
      )}
      <p className="text-xs text-text-muted">
        {credits.toLocaleString('en-US')} Wine Labs credits logged this month. Repeated wines in a sheet are matched
        once.
      </p>
      <LwinSheetMatcher disabled={!configured} />
    </main>
  );
};

export default LwinSheetPage;
