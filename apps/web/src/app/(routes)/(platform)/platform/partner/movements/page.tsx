'use client';

import Typography from '@/app/_ui/components/Typography/Typography';
import PartnerMovementsPanel from '@/app/_wms/components/PartnerMovementsPanel';

/**
 * A partner's stock ledger.
 *
 * The stock list says what is there now; this says how it got that way — and
 * crucially covers the wine that has gone, which by definition no longer
 * appears in a stock list.
 */
const PartnerMovementsPage = () => {
  return (
    <main className="container mx-auto max-w-[1400px] space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <Typography variant="headingLg" asChild>
          <h1>Movements</h1>
        </Typography>
        <Typography variant="bodySm" colorRole="muted" asChild>
          <p className="mt-1 max-w-2xl">
            Every receipt, pick and dispatch of your wine at the C&amp;C bonded
            warehouse, including wines no longer in stock.
          </p>
        </Typography>
      </div>

      <PartnerMovementsPanel limit={100} />
    </main>
  );
};

export default PartnerMovementsPage;
