import getOrderEmailMode from './getOrderEmailMode';

/**
 * Whether the older per-event Loops emails to partners and distributors send
 *
 * They stop once the new order emails are live, so nobody receives both. The
 * finance proforma email and the C&C team's new-order email are not part of
 * the new set and always send.
 *
 * @returns True unless order emails are live
 */
const isLegacyOrderEmailOn = async () => (await getOrderEmailMode()) !== 'live';

export default isLegacyOrderEmailOn;
