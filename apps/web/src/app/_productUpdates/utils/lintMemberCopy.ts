import type { ProductUpdateAudience } from '../types';

/** Words a member never reads, with what to say instead */
const BANNED: { pattern: RegExp; advice: string }[] = [
  { pattern: /\brelease(s|d)?\b/i, advice: 'Uses “release”. Say “request a delivery”' },
  { pattern: /\bparcels?\b/i, advice: 'Uses “parcel”. Say “wine” or “case”' },
  { pattern: /\bcall[- ]forward/i, advice: 'Uses “call forward”. Say “request a delivery”' },
  { pattern: /\bRAK\b|Ras Al Khaimah/i, advice: 'Names the location. Say “our bonded warehouse”' },
  { pattern: /\b(bug|error|glitch)s?\b/i, advice: 'Says “bug” or “error”. Describe what now works' },
  { pattern: /\b(PCO|SKU|LWIN|Zoho|WMS|admin)\b/i, advice: 'Uses an internal term' },
  { pattern: /\bfees?\b|\bAED\b|\bcharges?\b/i, advice: 'Mentions fees. Members are not shown charges here' },
  { pattern: /[—–]/, advice: 'Uses a dash as a sentence break. Split into two sentences' },
  { pattern: /!/, advice: 'Uses an exclamation mark' },
];

/** Names a trade partner must never see */
const COUNTERPARTIES = /\b(City Drinks|CD|MMI|African \+ Eastern|A\+E)\b/i;

/**
 * Check an update's wording against the member copy rules
 *
 * Runs on every draft, so a rule the AI broke is caught before anyone can
 * press Publish. Deterministic, so the same text always gets the same answer.
 *
 * @example
 *   lintMemberCopy({ title: 'Release a parcel', body: '', audiences: ['collector'] });
 *   // ['Uses “release”. Say “request a delivery”', 'Uses “parcel”. …']
 *
 * @param update - The title, body and audiences of the update
 * @returns What to fix, empty when the copy is fine
 */
const lintMemberCopy = ({
  title,
  body,
  audiences,
}: {
  title: string;
  body: string;
  audiences: ProductUpdateAudience[];
}) => {
  const text = `${title}\n${body}`;
  const flags = BANNED.filter((rule) => rule.pattern.test(text)).map((rule) => rule.advice);

  if (audiences.includes('wine_partner') && COUNTERPARTIES.test(text)) {
    flags.push('Names a distributor. Trade partners never see counterparties');
  }
  if (!title.trim()) flags.push('Needs a title');
  if (title.length > 90) flags.push('Title is long. Keep it under 90 characters');
  if (body.length > 360) flags.push('Text is long. Keep it to one or two sentences');
  if (audiences.length === 0) flags.push('Choose who it is for');

  return flags;
};

export default lintMemberCopy;
