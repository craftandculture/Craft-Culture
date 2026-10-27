'use client';

import CellarPageHeader from '@/app/_cellar/components/CellarPageHeader';
import PartnerActivityFeed from '@/app/_partners/components/PartnerActivityFeed';

/**
 * Everything that has happened to a member's wine, in one place
 *
 * The monthly statement summarises; this is the full record behind it, so a
 * collector can see every arrival, delivery and sale the day it happened.
 * Warehouse handling is folded, not hidden.
 */
const CellarActivityPage = () => {
  return (
    <div className="pb-8">
      <CellarPageHeader
        title="Activity"
        description="A complete record of your wine with us: every arrival, delivery and sale, newest first. Routine warehouse handling is grouped into a single line for each day."
      />

      <PartnerActivityFeed source="cellar" />
    </div>
  );
};

export default CellarActivityPage;
