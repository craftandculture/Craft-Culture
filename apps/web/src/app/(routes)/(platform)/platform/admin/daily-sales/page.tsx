import { redirect } from 'next/navigation';

import getUserOrRedirect from '@/app/_auth/data/getUserOrRedirect';
import DailySalesClient from '@/app/_distribution/components/DailySalesClient';
import isStaff from '@/app/_distribution/utils/isStaff';
import Typography from '@/app/_ui/components/Typography/Typography';

/**
 * Daily sales
 *
 * What City Drinks sold each day, read from their daily stock position. Kept
 * apart from Consignment & Distribution, which partners such as Crurated and
 * OpenCellar are shown, and limited to C&C staff — every owner's daily
 * movement is on this page.
 */
const DailySalesPage = async () => {
  const user = await getUserOrRedirect();

  if (!isStaff(user)) {
    redirect('/platform');
  }

  return (
    <main className="container space-y-6 py-8">
      <div>
        <Typography variant="headingLg" asChild>
          <h1>Daily sales</h1>
        </Typography>
        <Typography variant="bodySm" colorRole="muted" asChild>
          <p className="mt-1">
            What City Drinks sold each day, worked out from their daily stock count: yesterday&apos;s
            count, plus what we delivered, less today&apos;s. A day runs from one daily count to the next, early morning Dubai time.
            Valued at our invoice price. C&amp;C staff only.
          </p>
        </Typography>
      </div>
      <DailySalesClient />
    </main>
  );
};

export default DailySalesPage;
