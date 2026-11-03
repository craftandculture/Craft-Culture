import intakeStagesFor from './intakeStagesFor';
import type { IntakeRoute } from '../constants/intakeRoutes';

/** The member's steps between leaving for the UAE and arriving in their cellar */
const UAE_LEG = [
  { value: 'in_transit', label: 'On its way to the UAE' },
  { value: 'arrived_port', label: 'Arrived in the UAE' },
  { value: 'customs_clearance', label: 'Clearing customs' },
  { value: 'at_warehouse', label: 'Checking in at our warehouse' },
] as const;

/** Which UAE step a shipment status puts the wine at */
const UAE_LEG_STEP: Record<string, number> = {
  in_transit: 0,
  arrived_port: 1,
  customs_clearance: 2,
  cleared: 3,
  at_warehouse: 3,
  partially_received: 3,
};

/** The shipment statuses whose first date marks each step as reached */
const STEP_STATUSES: Record<string, string[]> = {
  in_progress: ['booked'],
  arriving_uk: ['picked_up'],
  in_transit: ['in_transit'],
  arrived_port: ['arrived_port'],
  customs_clearance: ['customs_clearance'],
  at_warehouse: ['cleared', 'at_warehouse', 'partially_received'],
  in_cellar: ['delivered'],
};

interface TimelineShipment {
  status: string;
  /** When the shipment first reached each status, as ISO strings */
  reachedAt: Record<string, string>;
}

/**
 * The steps on a member's incoming-wine tracker, how far along it is, and
 * when each step was reached
 *
 * "Shipping to the UAE" covered the flight, landing, customs and checking in,
 * so wine stuck in customs for days looked no different from wine still in
 * the air. On routes that cross into the UAE that one step becomes four,
 * driven by the linked shipment's status. The stored stage is unchanged, so
 * the team's controls and the stage notifications work as before.
 *
 * @example
 *   intakeTimeline('forwarder', 'shipping_uae', { status: 'customs_clearance', reachedAt: {} }).current;
 *   // 5: Clearing customs
 *
 * @param route - The transfer's route
 * @param stage - Its stage, after the shipment has moved it on
 * @param shipment - The linked shipment, if any
 * @param requestedAt - When the member asked, the date on the first step
 * @returns The steps, the index of the current one, and a date per reached step
 */
const intakeTimeline = (
  route: IntakeRoute,
  stage: string,
  shipment: TimelineShipment | null,
  requestedAt: Date | string | null = null,
) => {
  const base = intakeStagesFor(route);
  const splitUaeLeg = route !== 'uae';

  const steps: { value: string; label: string; date: string | null }[] = base.flatMap((step) =>
    splitUaeLeg && step.value === 'shipping_uae'
      ? UAE_LEG.map((leg) => ({ value: leg.value as string, label: leg.label as string, date: null }))
      : [{ value: step.value as string, label: step.label as string, date: null }],
  );

  let current = steps.findIndex((step) => step.value === stage);
  if (stage === 'shipping_uae' && splitUaeLeg) {
    const first = steps.findIndex((step) => step.value === UAE_LEG[0].value);
    current = first + (shipment ? (UAE_LEG_STEP[shipment.status] ?? 0) : 0);
  }
  current = Math.max(current, 0);

  steps.forEach((step, index) => {
    if (index > current) return;
    if (step.value === 'requested') {
      step.date = requestedAt ? new Date(requestedAt).toISOString() : null;
      return;
    }
    const dates = (STEP_STATUSES[step.value] ?? [])
      .map((status) => shipment?.reachedAt[status])
      .filter((date): date is string => Boolean(date))
      .sort();
    step.date = dates[0] ?? null;
  });

  return { steps, current };
};

export default intakeTimeline;
