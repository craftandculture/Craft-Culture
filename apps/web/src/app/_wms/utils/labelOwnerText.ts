/** What a label shows for a hidden owner whose reference is not available */
export const HIDDEN_OWNER_FALLBACK = 'PRIVATE CLIENT';

interface HiddenOwner {
  partnerId: string;
  name: string;
  code: string | null;
}

interface LabelOwner {
  id?: string | null;
  name?: string | null;
}

const normalise = (name: string) => name.trim().toLowerCase();

/**
 * The owner text to print on a physical label
 *
 * The one rule for every label: a hidden owner prints their reference
 * (PC-1001), or PRIVATE CLIENT if they have none; everyone else prints their
 * name. Matched on the partner id where the caller has it, otherwise on the
 * name, since several print paths only carry the name.
 *
 * Pass `hidden: null` when the hidden list could not be loaded: the label then
 * shows less, never a name that should have been hidden.
 *
 * @example
 *   labelOwnerText({ name: 'Ihab Toma' }, hidden); // 'PC-1001'
 *   labelOwnerText({ name: 'Cru Wine' }, hidden); // 'Cru Wine'
 *
 * @param owner - The stock owner, by id and/or name
 * @param hidden - Owners whose names must not print, or null if unknown
 * @returns The text for the label's owner field, or undefined for no owner
 */
const labelOwnerText = (owner: LabelOwner, hidden: HiddenOwner[] | null) => {
  if (!owner.id && !owner.name) return undefined;
  if (hidden === null) return HIDDEN_OWNER_FALLBACK;

  const match = hidden.find(
    (h) =>
      (owner.id && h.partnerId === owner.id) ||
      (owner.name && normalise(h.name) === normalise(owner.name)),
  );

  if (!match) return owner.name ?? undefined;
  return match.code ?? HIDDEN_OWNER_FALLBACK;
};

export default labelOwnerText;
