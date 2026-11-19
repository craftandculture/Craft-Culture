import type { WarehouseUpdateOrder } from '../types';

/**
 * An order's extra detail on one line: its reference and, on a private
 * client order, the client
 *
 * @param order - The order
 * @returns e.g. 'INV-000371 · PCO-2026-00060' or 'Mr A. Client', or an empty string
 */
const describeUpdateOrderLine = (order: WarehouseUpdateOrder) =>
  [order.reference, order.client].filter(Boolean).join(' · ');

export default describeUpdateOrderLine;
