import { MEMBER_EMAIL_TEMPLATES } from '@/app/_cellar/constants/memberEmailEvents';
import logisticsEmailTemplateId from '@/app/_logistics/utils/logisticsEmailTemplateId';
import { ORDER_EMAIL_TEMPLATE_ID } from '@/app/_privateClientOrders/constants';
import {
  DISTRIBUTOR_TEMPLATE_IDS,
  FINANCE_PROFORMA_TEMPLATE_ID,
} from '@/app/_privateClientOrders/utils/notifyDistributorOfOrderUpdate';
import { PARTNER_TEMPLATE_IDS } from '@/app/_privateClientOrders/utils/notifyPartnerOfOrderUpdate';

const words = (key: string) => key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

const MEMBER_NAMES: Record<keyof typeof MEMBER_EMAIL_TEMPLATES, string> = {
  cellarUpdate: 'Cellar: update',
  cellarWines: 'Cellar: wines',
  cellarDelivery: 'Cellar: delivery',
  cellarStatement: 'Cellar: statement',
  cellarInvite: 'Cellar: invitation',
};

/*
  The templates' own ids, read from where they are defined so the names never
  drift from what is sent. Templates written inline in one sender are named
  here by hand.
*/
const NAMES = new Map<string, string>([
  ...Object.entries(MEMBER_EMAIL_TEMPLATES).map(
    ([key, id]) => [id, MEMBER_NAMES[key as keyof typeof MEMBER_NAMES]] as [string, string],
  ),
  [ORDER_EMAIL_TEMPLATE_ID, 'Order update'],
  ...Object.entries(PARTNER_TEMPLATE_IDS).map(([key, id]) => [id, `Order (old): partner ${words(key)}`] as [string, string]),
  ...Object.entries(DISTRIBUTOR_TEMPLATE_IDS).map(
    ([key, id]) => [id, `Order (old): distributor ${words(key)}`] as [string, string],
  ),
  [FINANCE_PROFORMA_TEMPLATE_ID, 'Order: proforma to finance'],
  ['cmkj8qtdn08g90i25gzirspb4', 'Order submitted (to C&C)'],
  [logisticsEmailTemplateId(), 'Logistics'],
  ['logistics-document-expiry-summary', 'Logistics: documents expiring'],
  ['cmglxdfzwzzscz00inq1dm56c', 'Sign-in link'],
  ['cmhagixdf7c3z160h3aaga4xp', 'New user (to C&C)'],
  ['cmhexu2adkscr1y0ia83rd76j', 'Quote: buy request (to C&C)'],
  ['cmhexwjuhlk94zx0ifvn0kebv', 'Quote: confirmed'],
  ['cmjo8k5o27jt80izpamnt25fp', 'Quote: review started'],
  ['cmjo9lc6213bd0i0vxkpw0mae', 'Quote: revision requested'],
  ['cmjoadv7w7q0m0izpgnn0n8f2', 'Quote: payment'],
  ['cmjoaidzt4enk0i1lodg11200', 'Quote: delivered'],
]);

/**
 * What a Loops template is, in words, for the Sent Emails feed
 *
 * @example
 *   emailTemplateName('cmvqn73i502sf0jzhynk8f1m8'); // 'Order update'
 *   emailTemplateName('source-rfq-received'); // 'Source: rfq received'
 *
 * @param transactionalId - The Loops template id
 * @returns A short name, or the id when the template is not known
 */
const emailTemplateName = (transactionalId: string) => {
  const known = NAMES.get(transactionalId);
  if (known) return known;
  if (transactionalId.startsWith('source-')) return `Source: ${words(transactionalId.slice(7)).replace(/-/g, ' ')}`;
  return transactionalId;
};

export default emailTemplateName;
