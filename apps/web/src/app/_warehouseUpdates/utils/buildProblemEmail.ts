import describeUpdateOrderLine from './describeUpdateOrderLine';
import warehouseEmailData from './warehouseEmailData';
import type { WarehouseUpdateData } from '../types';

/**
 * The email when something has gone wrong with an order in the warehouse:
 * the order changed after picking started, or picking was stopped
 *
 * @param problem - The update
 * @param name - How the greeting addresses them
 * @returns The template variables
 */
const buildProblemEmail = (problem: WarehouseUpdateData, name: string) => {
  const order = problem.orders[0]!;
  const rows = [{ label: 'Order', value: order.label }];
  const detail = describeUpdateOrderLine(order);
  if (detail) rows.push({ label: 'Reference', value: detail });

  if (problem.problem === 'changed') {
    return warehouseEmailData({
      subject: `Order changed during picking: ${order.label}`,
      preheader: `${order.label} was changed after picking started. We are checking the pick against it.`,
      label: order.label,
      eyebrow: 'Please note',
      headline: 'Your order changed after picking started',
      name,
      body: 'Your order was amended after our warehouse had started picking it. We are checking the pick against the amended order and will confirm when it is packed. If you did not request a change, please let us know.',
      rows,
    });
  }

  return warehouseEmailData({
    subject: `Picking stopped: ${order.label}`,
    preheader: `Picking on ${order.label} has been stopped. Our team will be in touch.`,
    label: order.label,
    eyebrow: 'Please note',
    headline: 'Picking on your order has been stopped',
    name,
    body: 'The pick list for this order was withdrawn and the order has not yet been released again. Our team will contact you about it; please let us know if you need it urgently.',
    rows,
  });
};

export default buildProblemEmail;
