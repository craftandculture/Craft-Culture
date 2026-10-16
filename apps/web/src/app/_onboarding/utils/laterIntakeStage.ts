import type { IntakeStage } from '../constants/intakeStages';
import intakeStages from '../constants/intakeStages';

/**
 * The further along of a transfer's recorded stage and the one its shipment
 * implies
 *
 * A shipment only ever moves a transfer forward: a stage the team set by hand
 * is never pulled back, and a closed transfer stays closed.
 *
 * @example
 *   laterIntakeStage('arriving_uk', 'in_progress'); // 'arriving_uk'
 *   laterIntakeStage('requested', 'shipping_uae'); // 'shipping_uae'
 *
 * @param recorded - The stage on the transfer
 * @param implied - The stage its shipment implies, if any
 * @returns The stage to show
 */
const laterIntakeStage = (recorded: string, implied: IntakeStage | null) => {
  if (recorded === 'closed' || !implied) return recorded;
  const order = intakeStages.map((stage) => stage.value as string);
  return order.indexOf(implied) > order.indexOf(recorded) ? implied : recorded;
};

export default laterIntakeStage;
