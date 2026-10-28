import escapeSlackText from '@/lib/slack/escapeSlackText';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

import getTeam from './getTeam';
import postTasksSlack from '../utils/postTasksSlack';
import slackTag from '../utils/slackTag';

/** Who books the delivery once a client's payment is confirmed */
const DELIVERY_DESK = 'laraine@craftculture.xyz';

/**
 * Tell #tasks at once that a distributor has confirmed a client's payment
 *
 * The order can be released from that moment, so it does not wait for the
 * end-of-day report. Never throws: the verification stands either way.
 *
 * @example
 *   await postPaymentVerified({ id, orderNumber: 'PCO-2026-00104', clientName: 'Ihab Toma' });
 *
 * @param order - The order whose payment was verified
 */
const postPaymentVerified = async (order: { id: string; orderNumber: string; clientName: string | null }) => {
  try {
    const team = await getTeam();
    const owner = team.find((m) => m.email.toLowerCase() === DELIVERY_DESK);
    const link = `${serverConfig.appUrl}/platform/admin/private-orders/${order.id}`;
    const who = order.clientName ? ` · ${escapeSlackText(order.clientName)}` : '';
    await postTasksSlack(
      `Urgent: *<${link}|${escapeSlackText(order.orderNumber)}>*${who}\n${slackTag(owner)} client payment verified by the distributor: book the delivery`,
    );
  } catch (error) {
    logger.error('Payment verified post failed', { error, orderId: order.id });
  }
};

export default postPaymentVerified;
