import type { IntakeRoute } from '../constants/intakeRoutes';
import intakeStages from '../constants/intakeStages';

/**
 * The steps a member sees for a transfer, worded for its route
 *
 * The stored stage values are the same on every route, so a transfer can
 * change route without its stage being rewritten. Only what the member reads
 * changes: the UK bond step is the forwarder's collection on the direct route,
 * and does not exist for wine already in the UAE.
 *
 * @example
 *   intakeStagesFor('forwarder')[2]; // { value: 'arriving_uk', label: 'Collected by our forwarder' }
 *
 * @param route - The transfer's route
 * @returns The steps, in order
 */
const intakeStagesFor = (route: IntakeRoute) => {
  if (route === 'forwarder') {
    return intakeStages.map((stage) => {
      if (stage.value === 'in_progress') return { ...stage, label: 'We are arranging collection' };
      if (stage.value === 'arriving_uk') return { ...stage, label: 'Collected by our forwarder' };
      return { ...stage };
    });
  }

  if (route === 'uae') {
    return intakeStages
      .filter((stage) => stage.value !== 'arriving_uk')
      .map((stage) =>
        stage.value === 'shipping_uae' ? { ...stage, label: 'Moving in bond to our warehouse' } : { ...stage },
      );
  }

  return intakeStages.map((stage) => ({ ...stage }));
};

export default intakeStagesFor;
