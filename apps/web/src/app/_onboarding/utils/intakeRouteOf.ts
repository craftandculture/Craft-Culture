import type { IntakeRoute } from '../constants/intakeRoutes';

/**
 * The route a transfer takes, as set by the team or implied by its source
 *
 * Most wine abroad comes through our UK bond, so that is the default; wine
 * already in bond in the UAE never leaves the country. The team sets
 * `forwarder` for a merchant whose wine our forwarder collects and exports
 * straight to the UAE.
 *
 * @example
 *   intakeRouteOf({ route: null, source: 'uae_bond' }); // 'uae'
 *
 * @param intake - The transfer's stored route and source
 * @returns The route to show and track against
 */
const intakeRouteOf = (intake: { route: string | null; source: string }): IntakeRoute => {
  if (intake.route === 'uk_bond' || intake.route === 'forwarder' || intake.route === 'uae') return intake.route;
  return intake.source === 'uae_bond' ? 'uae' : 'uk_bond';
};

export default intakeRouteOf;
