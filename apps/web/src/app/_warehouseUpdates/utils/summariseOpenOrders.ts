import type { WarehouseUpdateData, WarehouseUpdateOrder } from '../types';

export interface SummaryEvent {
  kind: string;
  createdAt: Date;
  data: WarehouseUpdateData;
}

/**
 * Where each of a distributor's orders stands, from the warehouse updates
 * recorded on them, for the end-of-day summary
 *
 * Read in order: released → picking, picked → packed, ready → dispatched, a
 * cancelled pick list → no longer open (until it is released again).
 *
 * @param events - The distributor's recent updates, any order
 * @param dayStart - The start of today, Gulf time
 * @returns The orders being picked, packed awaiting dispatch, and dispatched today
 */
const summariseOpenOrders = (events: SummaryEvent[], dayStart: Date) => {
  const stage = new Map<string, { order: WarehouseUpdateOrder; stage: 'picking' | 'packed' | 'dispatched' | 'cancelled'; at: Date }>();

  for (const event of [...events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const next =
      event.kind === 'received'
        ? 'picking'
        : event.kind === 'picked'
          ? 'packed'
          : event.kind === 'ready'
            ? 'dispatched'
            : event.kind === 'problem' && event.data.problem === 'cancelled'
              ? 'cancelled'
              : null;
    if (!next) continue;
    for (const order of event.data.orders ?? []) {
      stage.set(order.orderId, { order, stage: next, at: event.createdAt });
    }
  }

  const all = [...stage.values()];
  const pick = (wanted: string) => all.filter((entry) => entry.stage === wanted).map((entry) => entry.order);
  return {
    picking: pick('picking'),
    packed: pick('packed'),
    dispatchedToday: all.filter((entry) => entry.stage === 'dispatched' && entry.at >= dayStart).map((entry) => entry.order),
  };
};

export default summariseOpenOrders;
