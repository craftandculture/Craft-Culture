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
    <main className="container space-y-5 py-8">
      <div>
        <Typography variant="headingLg" asChild>
          <h1>Movements</h1>
        </Typography>
        <Typography variant="bodySm" colorRole="muted" asChild>
          <p className="mt-1 max-w-2xl">
            Everything that has happened to your stock in the C&amp;C bonded
            warehouse — received, put away, moved between bays, picked,
            repacked, counted and dispatched. Wine that has been fully depleted
            appears here even though it has left your stock list.
          </p>
        </Typography>
      </div>

      <PartnerMovementsPanel limit={100} />
    </main>
  );
};

export default PartnerMovementsPage;
