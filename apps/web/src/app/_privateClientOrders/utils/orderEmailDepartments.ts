import type { OrderEmailEvent } from './orderEmailTypes';

/** The teams at a distributor that an order email can be meant for */
export type OrderEmailDepartment = 'purchasing' | 'finance';

const BOTH: OrderEmailDepartment[] = ['purchasing', 'finance'];

/**
 * Which teams at a distributor an order email is meant for
 *
 * Purchasing sets up the order and the SKU, so it verifies the client and
 * receives the wine. Finance collects from the client and pays us. A new order
 * that arrives already verified goes to both, since Purchasing still has to
 * set it up. Notes, cancellations and anything else go to both.
 *
 * @example
 *   orderEmailDepartments({ action: 'status_changed', newStatus: 'awaiting_distributor_verification', previousStatus: null }); // ['purchasing']
 *
 * @param event - The order event being emailed
 * @returns The teams it is meant for
 */
const orderEmailDepartments = (event: Pick<OrderEmailEvent, 'action' | 'newStatus' | 'previousStatus'>) => {
  if (event.action === 'note_added') return BOTH;

  switch (event.newStatus) {
    case 'awaiting_distributor_verification':
    case 'stock_in_transit':
      return ['purchasing'] as OrderEmailDepartment[];
    case 'awaiting_client_payment': {
      const isNew =
        !event.previousStatus || ['cc_approved', 'under_cc_review', 'submitted'].includes(event.previousStatus);
      return isNew ? BOTH : (['finance'] as OrderEmailDepartment[]);
    }
    case 'awaiting_payment_verification':
      return ['finance'] as OrderEmailDepartment[];
    default:
      return BOTH;
  }
};

export default orderEmailDepartments;
