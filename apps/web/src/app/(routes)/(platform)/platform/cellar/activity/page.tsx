'use client';

import PartnerActivityFeed from '@/app/_partners/components/PartnerActivityFeed';
import Typography from '@/app/_ui/components/Typography/Typography';

/**
 * Everything that has happened to a member's wine, in one place
 *
 * The monthly statement summarises; this is the full record behind it, so a
 * collector can see every arrival, delivery and sale the day it happened.
 * Warehouse handling is folded, not hidden.
 */
const CellarActivityPage = () => {
  return (
    <div className="space-y-5 pb-8">
      <div>
        <Typography variant="headingLg" asChild>
          <h1>Activity</h1>
        </Typography>
        <Typography variant="bodySm" colorRole="muted" asChild>
          <p className="mt-1 max-w-2xl">
            Everything that has happened to your wine with us, newest first.
            Routine handling in the warehouse, such as moving a case between
            bays, is folded into one line per day. Open it to see each step.
          </p>
        </Typography>
      </div>

      <PartnerActivityFeed source="cellar" />
    </div>
  );
};

export default CellarActivityPage;
