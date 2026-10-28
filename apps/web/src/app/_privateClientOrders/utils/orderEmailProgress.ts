import formatGulfDate from './formatGulfDate';
import type { OrderEmailAudience, OrderEmailSnapshot, OrderStatus } from './orderEmailTypes';

/** How far each status takes the order, on each party's six steps */
const PARTNER_STEPS = ['Submitted', 'Approved by C&C', 'Client verified', 'Payment received', 'With the distributor', 'Delivered'];
const DISTRIBUTOR_STEPS = ['Assigned to you', 'Client verified', 'Payment received', 'Stock received', 'Delivery scheduled', 'Delivered'];

const partnerStage = (status: OrderStatus): number => {
  switch (status) {
    case 'draft':
      return 0;
    case 'submitted':
    case 'under_cc_review':
    case 'revision_requested':
      return 1;
    case 'cc_approved':
    case 'awaiting_partner_verification':
    case 'awaiting_distributor_verification':
    case 'verification_suspended':
      return 2;
    case 'awaiting_client_payment':
    case 'awaiting_payment_verification':
      return 3;
    case 'client_paid':
    case 'awaiting_distributor_payment':
    case 'distributor_paid':
    case 'awaiting_partner_payment':
    case 'partner_paid':
    case 'stock_in_transit':
      return 4;
    case 'with_distributor':
    case 'scheduling_delivery':
    case 'delivery_scheduled':
    case 'out_for_delivery':
      return 5;
    case 'delivered':
      return 6;
    default:
      return -1;
  }
};

const distributorStage = (status: OrderStatus): number => {
  switch (status) {
    case 'awaiting_partner_verification':
    case 'awaiting_distributor_verification':
    case 'verification_suspended':
      return 1;
    case 'awaiting_client_payment':
    case 'awaiting_payment_verification':
      return 2;
    case 'client_paid':
    case 'awaiting_distributor_payment':
    case 'distributor_paid':
    case 'awaiting_partner_payment':
    case 'partner_paid':
    case 'stock_in_transit':
      return 3;
    case 'with_distributor':
    case 'scheduling_delivery':
      return 4;
    case 'delivery_scheduled':
    case 'out_for_delivery':
      return 5;
    case 'delivered':
      return 6;
    default:
      return status === 'cc_approved' ? 0 : -1;
  }
};

/**
 * The six steps an order passes through, as this party sees them
 *
 * A step is done once the order has reached it; its date is the first time
 * the order's history reached it. The step after the last one done is marked
 * as the current one. A cancelled order keeps the steps it reached.
 *
 * @param order - The order, with its history
 * @param audience - Whose steps
 * @returns Six rows of mark, label and date
 */
const orderEmailProgress = (order: OrderEmailSnapshot, audience: OrderEmailAudience) => {
  const labels = audience === 'partner' ? PARTNER_STEPS : DISTRIBUTOR_STEPS;
  const stageOf = audience === 'partner' ? partnerStage : distributorStage;

  // The furthest the order has been, so a cancellation does not undo its steps
  const reached = Math.max(stageOf(order.status), ...order.history.map((h) => stageOf(h.status)));

  return labels.map((label, index) => {
    const step = index + 1;
    if (step <= reached) {
      const first = order.history
        .filter((h) => stageOf(h.status) >= step)
        .sort((a, b) => a.at.getTime() - b.at.getTime())[0];
      return { mark: '✓', label, when: first ? formatGulfDate(first.at, 'short') : '' };
    }
    if (step === reached + 1 && order.status !== 'cancelled') return { mark: '→', label, when: 'Next' };
    return { mark: '○', label, when: '' };
  });
};

export default orderEmailProgress;
