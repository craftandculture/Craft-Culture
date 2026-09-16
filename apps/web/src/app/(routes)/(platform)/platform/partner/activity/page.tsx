'use client';

import PartnerActivityFeed from '@/app/_partners/components/PartnerActivityFeed';
import Typography from '@/app/_ui/components/Typography/Typography';

/**
 * Everything that has happened to a partner, in one place.
 *
 * Stock, orders and RFQs were three screens answering one question, each with
 * its own clock.
 */
const PartnerActivityPage = () => {
  return (
    <main className="container space-y-5 py-8">
      <div>
        <Typography variant="headingLg" asChild>
          <h1>Activity</h1>
        </Typography>
        <Typography variant="bodySm" colorRole="muted" asChild>
          <p className="mt-1 max-w-2xl">
            Your stock in the C&amp;C warehouse, your private-client orders and
            the RFQs you were invited to — in one feed, newest first.
          </p>
        </Typography>
      </div>

      <PartnerActivityFeed />
    </main>
  );
};

export default PartnerActivityPage;
