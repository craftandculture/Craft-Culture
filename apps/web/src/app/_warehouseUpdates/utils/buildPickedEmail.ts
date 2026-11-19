import describeSize from './describeSize';
import describeUpdateOrderLine from './describeUpdateOrderLine';
import warehouseEmailData from './warehouseEmailData';
import type { WarehouseUpdateData } from '../types';

const WINES_SHOWN = 12;

/**
 * The picked & packed email: one order with its wines, or several orders
 * picked since the last update, one line each
 *
 * @param picks - Each completed pick list's update
 * @param name - How the greeting addresses them
 * @returns The template variables
 */
const buildPickedEmail = (picks: WarehouseUpdateData[], name: string) => {
  const orders = picks.flatMap((pick) => pick.orders.map((order) => ({ order, pick })));
  const cases = picks.reduce((sum, pick) => sum + (pick.cases ?? 0), 0);
  const bottles = picks.reduce((sum, pick) => sum + (pick.bottles ?? 0), 0);
  const size = describeSize(cases, bottles);

  if (orders.length === 1) {
    const [{ order, pick }] = orders as [(typeof orders)[number]];
    const lines = pick.lines ?? [];
    const rows = [{ label: 'Order', value: order.label }];
    const detail = describeUpdateOrderLine(order);
    if (detail) rows.push({ label: order.client ? 'Reference · client' : 'Reference', value: detail });
    if (size) rows.push({ label: 'Packed', value: size });

    return warehouseEmailData({
      subject: `Picked and packed: ${order.label}`,
      preheader: `${order.label} has been picked and packed at the C&C warehouse${size ? `: ${size}` : ''}.`,
      label: order.label,
      eyebrow: 'Warehouse update',
      headline: 'Your order has been picked and packed',
      name,
      body: 'Your order has been picked and packed at the C&C bonded warehouse. We will email you again when it is ready for dispatch.',
      rows,
      winesTitle: lines.length ? [{ title: `Packed · ${lines.length} ${lines.length === 1 ? 'wine' : 'wines'}` }] : [],
      wines: lines.slice(0, WINES_SHOWN).map((line) => ({ name: line.name, detail: '', quantity: line.quantity })),
      winesMore: lines.length > WINES_SHOWN ? [{ text: `And ${lines.length - WINES_SHOWN} more wines.` }] : [],
    });
  }

  return warehouseEmailData({
    subject: `Picked and packed: ${orders.length} orders`,
    preheader: `${orders.length} of your orders have been picked and packed${size ? `: ${size}` : ''}.`,
    label: `${orders.length} orders`,
    eyebrow: 'Warehouse update',
    headline: `${orders.length} orders picked and packed`,
    name,
    body: 'The orders below have been picked and packed at the C&C bonded warehouse since our last update. We will email you again when they are ready for dispatch.',
    rows: orders.map(({ order, pick }) => ({
      label: order.label,
      value: [describeUpdateOrderLine(order), describeSize(pick.cases, pick.bottles)].filter(Boolean).join(' · ') || 'Packed',
    })),
  });
};

export default buildPickedEmail;
