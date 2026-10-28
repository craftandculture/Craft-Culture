import getOrderEmailMode from './getOrderEmailMode';
import type { OrderEmailAudience } from '../utils/orderEmailTypes';

/**
 * Whether the older per-event Loops emails to partners and distributors send
 *
 * They stop once the new order emails are live, so nobody receives both. The
 * finance proforma email and the C&C team's new-order email are not part of
 * the new set and always send.
 *
 * @param audience - Wine partners or distributors
 * @returns True unless that audience's order emails are live
 */
const isLegacyOrderEmailOn = async (audience: OrderEmailAudience) => (await getOrderEmailMode(audience)) !== 'live';

export default isLegacyOrderEmailOn;
