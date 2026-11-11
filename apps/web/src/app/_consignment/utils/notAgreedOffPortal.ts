import { sql } from 'drizzle-orm';

import { saleMandates } from '@/database/schema';

import { AGREED_OFF_PORTAL_NOTE } from '../constants/agreedOffPortal';

/**
 * Offers a member made themselves, leaving out prices agreed away from the portal
 *
 * For the queues that ask staff to decide an offer: an agreed price is not
 * the member asking to be listed, so it has nothing to decide.
 */
const notAgreedOffPortal = sql`(${saleMandates.adminNotes} IS NULL OR ${saleMandates.adminNotes} NOT LIKE ${`%${AGREED_OFF_PORTAL_NOTE}%`})`;

export default notAgreedOffPortal;
