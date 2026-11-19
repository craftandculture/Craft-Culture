import describeUpdateOrderLine from './describeUpdateOrderLine';
import warehouseEmailData from './warehouseEmailData';
import type { WarehouseUpdateOrder } from '../types';

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * The end-of-day summary: every open order and where it stands, and what was
 * dispatched today
 *
 * @param summary - The orders being picked, packed and dispatched today
 * @param name - How the greeting addresses them
 * @param day - Today, as it reads in the email
 * @returns The template variables
 */
const buildSummaryEmail = (
  summary: { picking: WarehouseUpdateOrder[]; packed: WarehouseUpdateOrder[]; dispatchedToday: WarehouseUpdateOrder[] },
  name: string,
  day: string,
) => {
  const parts = [
    summary.picking.length && `${summary.picking.length} being picked`,
    summary.packed.length && `${summary.packed.length} packed awaiting dispatch`,
    summary.dispatchedToday.length && `${summary.dispatchedToday.length} dispatched today`,
  ].filter(Boolean) as string[];

  const line = (stage: string) => (order: WarehouseUpdateOrder) => ({
    label: order.label,
    value: [stage, describeUpdateOrderLine(order)].filter(Boolean).join(' · '),
  });

  const open = summary.picking.length + summary.packed.length;

  return warehouseEmailData({
    subject: `Your orders at the C&C warehouse: ${parts.join(', ')}`,
    preheader: `${parts.join(', ')}.`.replace(/^./, (c) => c.toUpperCase()),
    label: day,
    eyebrow: 'End of day',
    headline: 'Where your orders stand',
    name,
    body: open
      ? `You have ${plural(open, 'open order', 'open orders')} at the C&C bonded warehouse. Each is listed below with where it stands tonight; we email you again as soon as an order is ready for dispatch.`
      : 'Everything we had for you has now left the C&C bonded warehouse. The orders dispatched today are listed below.',
    rows: [
      ...summary.packed.map(line('Packed, awaiting dispatch')),
      ...summary.picking.map(line('Being picked')),
      ...summary.dispatchedToday.map(line('Dispatched today')),
    ],
  });
};

export default buildSummaryEmail;
