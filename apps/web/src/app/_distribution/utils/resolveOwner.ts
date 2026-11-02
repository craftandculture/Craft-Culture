export interface OwnerRef {
  id: string;
  name: string;
  /** CC, CRU, CULT, CRURATED, RARE — unique, so a tag is a key not a guess */
  consignmentTag: string | null;
  /** Other spellings seen on documents, so one owner is not read as two */
  ownerAliases: string[] | null;
  takesUnattributed: boolean;
}

export interface ResolveOwnerInput {
  /** The CONSIGNMENT_* tag the document carried, if any */
  tag: string | null;
  /** Whose the outlet's own register (the Codes tab) says it is */
  registerOwnerId?: string | null;
  /** Whose wine this was last time we saw it, by LWIN */
  knownOwnerId?: string | null;
  owners: OwnerRef[];
}

export interface ResolvedOwner {
  ownerId: string | null;
  /** Why, in the words the screen will show. A wrong answer has to be traceable. */
  reason: string;
}

const squash = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Decide whose wine a line is
 *
 * One function, one precedence, used by every consumer. The tool this replaces
 * decided ownership in five places that disagreed, with the tag-to-owner table
 * written out three separate times — once in TypeScript, once again in
 * TypeScript, and once as a SQL CASE — so a line could be Cult's on one screen
 * and Crurated's on the next.
 *
 * The order is deliberate:
 *
 * 1. **The document's tag.** Naming an owner on an invoice is a deliberate act
 *    and beats anything inferred. Matched exactly, never by prefix: `CRU` is
 *    the start of `CRURATED`, and a prefix match would file every Crurated
 *    invoice under Cru Wine.
 * 2. **The outlet's register.** The Codes tab of the payment-run sheet names
 *    the owner of each code against the invoice it came in on, and it is kept
 *    by the person who settles the account.
 * 3. **What the wine was last time.** A mixed invoice names its owners in
 *    heading rows that Zoho drops on read, so the document says nothing the
 *    API will return — but a wine's owner does not change between invoices.
 * 4. **Nobody.** Shown as unattributed rather than folded into someone, because
 *    that count is the work outstanding and hiding it makes the month look
 *    finished. There used to be a step before this that handed every unnamed
 *    line to whoever "takes unattributed" — Crurated — and it filed other
 *    owners' wine under them with no trace. A line nobody named now waits in
 *    the queue with a suggestion, for a person to confirm.
 *
 * @param input - The tag, what is known about the wine, and the owners
 * @returns The owner and the reason, or null with the reason it found none
 */
const resolveOwner = ({
  tag,
  registerOwnerId,
  knownOwnerId,
  owners,
}: ResolveOwnerInput): ResolvedOwner => {
  if (tag) {
    const wanted = squash(tag);
    const byTag = owners.find(
      (owner) => owner.consignmentTag && squash(owner.consignmentTag) === wanted,
    );

    if (byTag) {
      return { ownerId: byTag.id, reason: `Document tagged ${tag}` };
    }

    const byAlias = owners.find((owner) =>
      (owner.ownerAliases ?? []).some((alias) => squash(alias) === wanted),
    );

    if (byAlias) {
      return { ownerId: byAlias.id, reason: `Document tagged ${tag}` };
    }
  }

  if (registerOwnerId) {
    const listed = owners.find((owner) => owner.id === registerOwnerId);

    if (listed) {
      return {
        ownerId: listed.id,
        reason: tag
          ? `Tag ${tag} is not an owner we know; taken from the Codes tab`
          : 'Taken from the Codes tab',
      };
    }
  }

  if (knownOwnerId) {
    const known = owners.find((owner) => owner.id === knownOwnerId);

    if (known) {
      return {
        ownerId: known.id,
        reason: tag
          ? `Tag ${tag} is not an owner we know; taken from the wine`
          : 'Taken from the wine',
      };
    }
  }

  return {
    ownerId: null,
    reason: tag
      ? `Tagged ${tag}, which matches no owner — waiting for an owner`
      : 'Nobody named an owner — waiting for an owner',
  };
};

export default resolveOwner;
