/**
 * The Loops template that freight emails go out through, if one is set
 *
 * A plain template sending from logistics@craftculture.xyz, with `subject`,
 * `replyTo` and `cc` in its sending settings and an array block `lines` whose
 * `text` repeats once per line of the body. Unset, the request page offers
 * the emails to copy instead of a Send button.
 *
 * @example
 *   if (logisticsEmailTemplateId()) { ... }
 *
 * @returns The Loops transactional id, or null
 */
const logisticsEmailTemplateId = () => process.env.LOGISTICS_EMAIL_TEMPLATE_ID?.trim() || null;

export default logisticsEmailTemplateId;
