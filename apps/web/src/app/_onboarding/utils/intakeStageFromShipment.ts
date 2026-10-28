import type { IntakeRoute } from '../constants/intakeRoutes';
import type { IntakeStage } from '../constants/intakeStages';

/**
 * The transfer stage a linked inbound shipment's status implies
 *
 * On the UK bond route only the UAE leg is in the logistics module, so the
 * UK bond stage stays with the team. On the forwarder route the shipment is
 * the whole journey, so its collection is the member's "collected" step. A
 * draft or cancelled shipment implies nothing.
 *
 * @example
 *   intakeStageFromShipment('in_transit'); // 'shipping_uae'
 *
 * @param status - The shipment's status
 * @param route - The transfer's route
 * @returns The stage it implies, or null
 */
const intakeStageFromShipment = (status: string, route: IntakeRoute = 'uk_bond'): IntakeStage | null => {
  switch (status) {
    case 'booked':
      return 'in_progress';
    case 'picked_up':
      return route === 'forwarder' ? 'arriving_uk' : 'in_progress';
    case 'in_transit':
    case 'arrived_port':
    case 'customs_clearance':
    case 'cleared':
    case 'at_warehouse':
    case 'partially_received':
      return 'shipping_uae';
    case 'delivered':
      return 'in_cellar';
    default:
      return null;
  }
};

export default intakeStageFromShipment;
