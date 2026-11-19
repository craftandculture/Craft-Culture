import describeSize from './describeSize';
import describeUpdateOrderLine from './describeUpdateOrderLine';
import warehouseEmailData from './warehouseEmailData';
import type { WarehouseUpdateData } from '../types';

/**
 * The ready for dispatch email: every order going out together, the case
 * count and the delivery note
 *
 * A batch dispatched without being staged first has already left, and the
 * email says so.
 *
 * @param ready - The dispatch batch's update
 * @param name - How the greeting addresses them
 * @returns The template variables
 */
const buildReadyEmail = (ready: WarehouseUpdateData, name: string) => {
  const gone = ready.stage === 'dispatched';
  const count = ready.orders.length;
  const what = count === 1 ? ready.orders[0]!.label : `${count} orders`;
  const size = describeSize(ready.cases, ready.bottles);

  const rows = ready.orders.map((order) => ({ label: order.label, value: describeUpdateOrderLine(order) || 'Included' }));
  if (size) rows.push({ label: 'Total', value: size });
  if (ready.deliveryNoteNumber) rows.push({ label: 'Delivery note', value: ready.deliveryNoteNumber });

  return warehouseEmailData({
    subject: gone ? `Dispatched: ${what}` : `Ready for dispatch: ${what}`,
    preheader: `${what}${size ? `, ${size},` : ''} ${gone ? 'has left the C&C warehouse' : 'is ready for dispatch from the C&C warehouse'}.`,
    label: ready.batchNumber ?? what,
    eyebrow: gone ? 'Dispatched' : 'Ready for dispatch',
    headline: gone
      ? count === 1
        ? 'Your order has been dispatched'
        : 'Your orders have been dispatched'
      : count === 1
        ? 'Your order is ready for dispatch'
        : 'Your orders are ready for dispatch',
    name,
    body: gone
      ? 'The orders below have left the C&C bonded warehouse together. Please be ready to receive them.'
      : 'The orders below are packed and ready to leave the C&C bonded warehouse together. Please arrange collection or be ready to receive them.',
    rows,
    ...(ready.deliveryNoteUrl
      ? {
          ctaLabel: 'Download the delivery note',
          ctaUrl: ready.deliveryNoteUrl,
        }
      : {}),
  });
};

export default buildReadyEmail;
