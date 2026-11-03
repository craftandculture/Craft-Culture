import intakeStagesFor from './intakeStagesFor';
import type { IntakeRoute } from '../constants/intakeRoutes';

/** The member's steps between leaving for the UAE and arriving in their cellar */
const UAE_LEG = [
  { value: 'in_transit', label: 'On its way to the UAE' },
  { value: 'arrived_port', label: 'Arrived in the UAE' },
  { value: 'customs_clearance', label: 'Clearing customs' },
  { value: 'cleared', label: 'Cleared customs' },
  { value: 'at_warehouse', label: 'Checking in at our warehouse' },
] as const;

/** Which UAE step a shipment status puts the wine at */
const UAE_LEG_STEP: Record<string, number> = {
  in_transit: 0,
  arrived_port: 1,
  customs_clearance: 2,
  cleared: 3,
  at_warehouse: 4,
  partially_received: 4,
};

/** The shipment statuses whose first date marks each step as reached */
const STEP_STATUSES: Record<string, string[]> = {
  in_progress: ['booked'],
  arriving_uk: ['picked_up'],
  in_transit: ['in_transit'],
  arrived_port: ['arrived_port'],
  customs_clearance: ['customs_clearance'],
  cleared: ['cleared'],
  at_warehouse: ['at_warehouse', 'partially_received'],
  in_cellar: ['delivered'],
};

/** What happens next, shown under the step the wine is at */
const NEXT: Record<string, string> = {
  requested: 'We will be in touch to confirm the arrangements.',
  in_progress: 'We are arranging the transfer with the current holder.',
  arriving_uk: 'Your wine is being prepared for its journey to the UAE.',
  in_transit: 'Your wine is travelling in bond to the UAE.',
  arrived_port: 'Your wine has landed and will now clear customs.',
  customs_clearance: 'Once cleared, your wine comes straight to our warehouse.',
  cleared: 'Your wine is on its way to our warehouse.',
  at_warehouse: 'We are checking each bottle into your cellar.',
};

/** Said differently where the route changes what is happening */
const NEXT_BY_ROUTE: Partial<Record<IntakeRoute, Record<string, string>>> = {
  forwarder: {
    in_progress: 'Our forwarder will collect your wine from the merchant.',
  },
  uk_bond: {
    arriving_uk: 'Your wine is held in our UK bond until it ships to the UAE.',
  },
  uae: {
    shipping_uae: 'Your wine is moving in bond to our warehouse.',
  },
};

interface TimelineShipment {
  status: string;
  /** When the shipment first reached each status, as ISO strings */
  reachedAt: Record<string, string>;
  eta?: Date | string | null;
  /** The member's bottles on board, and how many the warehouse has received */
  bottles?: number;
  receivedBottles?: number;
}

/**
 * The steps on a member's incoming-wine tracker, how far along it is, when
 * each step was reached, and what happens next
 *
 * "Shipping to the UAE" covered the flight, landing, customs and checking in,
 * so wine stuck in customs for days looked no different from wine still in
 * the air. On routes that cross into the UAE that one step becomes five,
 * driven by the linked shipment's status, and checking in follows the
 * warehouse's receiving. The stored stage is unchanged, so the team's
 * controls and the stage notifications work as before.
 *
 * @example
 *   intakeTimeline('forwarder', 'shipping_uae', { status: 'customs_clearance', reachedAt: {} }).current;
 *   // 5: Clearing customs
 *
 * @param route - The transfer's route
 * @param stage - Its stage, after the shipment and receiving have moved it on
 * @param shipment - The linked shipment, if any
 * @param requestedAt - When the member asked, the date on the first step
 * @param now - Today, so an expected date already passed is not shown
 * @returns The steps, the current one, a date per reached step and the line under the current one
 */
const intakeTimeline = (
  route: IntakeRoute,
  stage: string,
  shipment: TimelineShipment | null,
  requestedAt: Date | string | null = null,
  now: Date = new Date(),
) => {
  const base = intakeStagesFor(route);
  const splitUaeLeg = route !== 'uae';

  const steps: { value: string; label: string; date: string | null; expected: string | null }[] = base.flatMap(
    (step) =>
      splitUaeLeg && step.value === 'shipping_uae'
        ? UAE_LEG.map((leg) => ({ value: leg.value as string, label: leg.label as string, date: null, expected: null }))
        : [{ value: step.value as string, label: step.label as string, date: null, expected: null }],
  );

  const received = shipment?.receivedBottles ?? 0;
  const checkingIn = received > 0 && stage !== 'in_cellar';

  let current = steps.findIndex((step) => step.value === stage);
  if (stage === 'shipping_uae' && splitUaeLeg) {
    const first = steps.findIndex((step) => step.value === UAE_LEG[0].value);
    // Bottles already received put it at checking in, whatever the shipment says
    const leg = checkingIn ? UAE_LEG.length - 1 : shipment ? (UAE_LEG_STEP[shipment.status] ?? 0) : 0;
    current = first + leg;
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

  // The expected arrival, on the arrival step, while it is still ahead
  const eta = shipment?.eta ? new Date(shipment.eta) : null;
  const arrival = steps.findIndex((step) => step.value === 'arrived_port');
  if (eta && arrival > current && eta.getTime() > now.getTime()) {
    steps[arrival]!.expected = eta.toISOString();
  }

  const at = steps[current]?.value ?? stage;
  const routeNext = NEXT_BY_ROUTE[route]?.[at] ?? NEXT_BY_ROUTE[route]?.[stage];
  let next = routeNext ?? NEXT[at] ?? null;
  if (at === 'at_warehouse' && checkingIn && shipment?.bottles) {
    next = `${received} of ${shipment.bottles} bottles checked into your cellar so far.`;
  }

  return { steps, current, next };
};

export default intakeTimeline;
