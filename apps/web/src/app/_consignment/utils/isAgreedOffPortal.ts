import { AGREED_OFF_PORTAL_NOTE } from '../constants/agreedOffPortal';

/**
 * Whether an offer was recorded from prices agreed away from the portal
 *
 * @example
 *   isAgreedOffPortal(mandate.adminNotes); // true for an agreed price
 */
const isAgreedOffPortal = (adminNotes: string | null | undefined) =>
  !!adminNotes?.includes(AGREED_OFF_PORTAL_NOTE);

export default isAgreedOffPortal;
