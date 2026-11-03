/** A UK to UAE move's steps as the member sees them, and the shipment statuses at each */
const STEPS = [
  { label: 'Requested', statuses: [] },
  { label: 'Price ready', statuses: [] },
  { label: 'Accepted', statuses: [] },
  { label: 'On its way to the UAE', statuses: ['booked', 'picked_up', 'in_transit'] },
  { label: 'Arrived in the UAE', statuses: ['arrived_port'] },
  { label: 'Clearing customs', statuses: ['customs_clearance'] },
  { label: 'Cleared customs', statuses: ['cleared'] },
  { label: 'Checking in at our warehouse', statuses: ['at_warehouse', 'partially_received'] },
  { label: 'In your cellar', statuses: ['delivered'] },
] as const;

export interface UkMoveForSteps {
  status: string;
  shipmentStatus: string | null;
  createdAt: Date | string;
  quotedAt: Date | string | null;
  acceptedAt: Date | string | null;
  shippedAt: Date | string | null;
  arrivedAt: Date | string | null;
  eta: Date | string | null;
  /** When the shipment first reached each status, ISO strings */
  reachedAt: Record<string, string>;
}

const iso = (value: Date | string | null | undefined) => (value ? new Date(value).toISOString() : null);

/**
 * The tracker on a member's move from London City Bond to the UAE
 *
 * The move itself gives the first three steps (asked, priced, accepted); once
 * it ships, the shipment carrying it gives the rest, the same steps a member
 * sees for any wine coming in. The expected arrival shows on the arrival step
 * only while it is still ahead.
 *
 * @example
 *   ukMoveSteps({ status: 'quoted', ... }).current; // 1: Price ready
 *
 * @param move - The move, its dates and its shipment's progress
 * @param now - Today
 * @returns The steps and the index of the current one
 */
const ukMoveSteps = (move: UkMoveForSteps, now: Date = new Date()) => {
  const shipmentStep = STEPS.findIndex((step) => (step.statuses as readonly string[]).includes(move.shipmentStatus ?? ''));
  const current =
    move.status === 'arrived'
      ? STEPS.length - 1
      : move.status === 'shipping'
        ? Math.max(3, shipmentStep)
        : move.status === 'accepted'
          ? 2
          : move.status === 'quoted'
            ? 1
            : 0;

  const first = (statuses: readonly string[]) =>
    statuses
      .map((status) => move.reachedAt[status])
      .filter((at): at is string => Boolean(at))
      .sort()
      .at(0) ?? null;

  const dates = [
    iso(move.createdAt),
    iso(move.quotedAt),
    iso(move.acceptedAt),
    iso(move.shippedAt) ?? first(STEPS[3].statuses),
    first(STEPS[4].statuses),
    first(STEPS[5].statuses),
    first(STEPS[6].statuses),
    first(STEPS[7].statuses),
    iso(move.arrivedAt) ?? first(STEPS[8].statuses),
  ];
  const eta = move.eta && new Date(move.eta).getTime() > now.getTime() ? iso(move.eta) : null;

  const steps = STEPS.map((step, index) => ({
    label: step.label as string,
    done: index <= current,
    date: index <= current ? (dates.at(index) ?? null) : null,
    expected: index === 4 && index > current ? eta : null,
  }));

  return { steps, current };
};

export default ukMoveSteps;
