import type { UaeArrivalRateCard } from '../schemas/uaeArrivalRateCardSchema';

/**
 * The UAE arrival charges until someone edits them, from GAC's clearance
 * invoice for a 2-pallet air shipment into RAK (Oct 2026)
 *
 * Left out: the AED 1,000 deposit against original documents, which is
 * refunded, and VAT, which is recovered.
 */
const defaultUaeArrivalRateCard: UaeArrivalRateCard = {
  lines: [
    { label: 'Customs seals (2)', amountAed: 40, covers: 'customs', modes: 'all' },
    { label: 'Customs fee (manifest)', amountAed: 35, covers: 'customs', modes: 'all' },
    { label: 'Bill of entry', amountAed: 185, covers: 'customs', modes: 'all' },
    { label: 'Export bill', amountAed: 195, covers: 'customs', modes: 'all' },
    { label: 'Documentation', amountAed: 275, covers: 'customs', modes: 'all' },
    { label: 'Inspection attendance', amountAed: 150, covers: 'customs', modes: 'all' },
    { label: 'Deposit refund submission', amountAed: 70, covers: 'customs', modes: 'all' },
    { label: 'Airport handling', amountAed: 590, covers: 'handling', modes: 'air' },
    { label: 'DO collection', amountAed: 250, covers: 'handling', modes: 'all' },
    { label: 'GAC service charge', amountAed: 250, covers: 'handling', modes: 'all' },
  ],
  variables: [{ label: 'Missing certificate of origin', amountAed: 1000, per: 'document' }],
};

export default defaultUaeArrivalRateCard;
