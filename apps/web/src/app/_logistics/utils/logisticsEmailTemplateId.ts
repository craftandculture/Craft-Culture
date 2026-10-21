/** "Logistics email" in Loops: from logistics@craftculture.xyz, replies to logistics@, created 21 October 2026 */
const DEFAULT_TEMPLATE_ID = 'cmvhyqvcc036f0jycauhd6fwv';

/**
 * The Loops template that freight emails go out through
 *
 * A plain template sending from logistics@craftculture.xyz with replies to the
 * same inbox. Its subject is the `subject` data variable, and its body an
 * array block `lines` whose `text` repeats once per line. The env var
 * overrides it, for pointing at a different template without a code change.
 *
 * @example
 *   logisticsEmailTemplateId(); // 'cmvhyqvcc036f0jycauhd6fwv'
 *
 * @returns The Loops transactional id
 */
const logisticsEmailTemplateId = () => process.env.LOGISTICS_EMAIL_TEMPLATE_ID?.trim() || DEFAULT_TEMPLATE_ID;

export default logisticsEmailTemplateId;
