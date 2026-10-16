import type { IntakeStage } from '../constants/intakeStages';

/**
 * The transfer stage a linked inbound shipment's status implies
 *
 * Only the UAE leg is in the logistics module, so a shipment can move a
 * transfer to "arranging", "shipping to the UAE" or "in your cellar" — the
 * UK bond stage before it stays with the team. A draft or cancelled shipment
 * implies nothing.
 *
 * @example
 *   intakeStageFromShipment('in_transit'); // 'shipping_uae'
 *
 * @param status - The shipment's status
 * @returns The stage it implies, or null
 */
const intakeStageFromShipment = (status: string): IntakeStage | null => {
  switch (status) {
    case 'booked':
    case 'picked_up':
      return 'in_progress';
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
