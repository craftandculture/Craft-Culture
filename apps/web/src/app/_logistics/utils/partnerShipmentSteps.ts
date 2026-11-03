/** An inbound shipment's steps as a wine partner sees them, and the statuses at each */
const STEPS = [
  { label: 'Booked', statuses: ['booked'] },
  { label: 'Collected', statuses: ['picked_up'] },
  { label: 'Departed', statuses: ['in_transit'] },
  { label: 'Arrived in the UAE', statuses: ['arrived_port'] },
  { label: 'Clearing customs', statuses: ['customs_clearance'] },
  { label: 'Cleared customs', statuses: ['cleared'] },
  { label: 'Receiving at our warehouse', statuses: ['at_warehouse', 'partially_received'] },
  { label: 'In stock', statuses: ['delivered'] },
] as const;

/**
 * The tracker on a wine partner's inbound shipment: each step, whether it is
 * done, and the date it was reached
 *
 * A step the shipment skipped is ticked with no date. The departure uses the
 * recorded departure date where the team gave one. The expected arrival shows
 * on the arrival step only while it is still ahead.
 *
 * @example
 *   partnerShipmentSteps('customs_clearance', { arrived_port: '2026-11-01T08:00:00Z' }, null, null).current;
 *   // 4: Clearing customs
 *
 * @param status - The shipment's status
 * @param reachedAt - When it first reached each status, ISO strings
 * @param atd - Its recorded departure
 * @param eta - Its expected arrival
 * @param now - Today
 * @returns The steps and the index of the current one (-1 before booking)
 */
const partnerShipmentSteps = (
  status: string,
  reachedAt: Record<string, string>,
  atd: Date | string | null,
  eta: Date | string | null,
  now: Date = new Date(),
) => {
  const current = STEPS.findIndex((step) => (step.statuses as readonly string[]).includes(status));
  const expected = eta && new Date(eta).getTime() > now.getTime() ? new Date(eta).toISOString() : null;

  const steps = STEPS.map((step, index) => {
    const first = step.statuses
      .map((s) => reachedAt[s])
      .filter((at): at is string => Boolean(at))
      .sort()
      .at(0);
    const date = index <= current ? (step.label === 'Departed' && atd ? new Date(atd).toISOString() : (first ?? null)) : null;
    return {
      label: step.label,
      done: index <= current,
      date,
      expected: step.label === 'Arrived in the UAE' && index > current ? expected : null,
    };
  });

  return { steps, current };
};

export default partnerShipmentSteps;
