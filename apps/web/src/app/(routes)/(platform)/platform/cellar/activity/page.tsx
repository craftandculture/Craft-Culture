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
        description="Everything that has happened to your wine with us, newest first. Routine handling in the warehouse, such as moving a case within the warehouse, is folded into one line per day. Open it to see each step."
      />

      <PartnerActivityFeed source="cellar" />
    </div>
  );
};

export default CellarActivityPage;
