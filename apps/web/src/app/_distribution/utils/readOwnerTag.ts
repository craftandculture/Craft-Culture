/**
 * The owner tag inside a subject line
 *
 * `CONSIGNMENT_CULT` names Cult; `CONSIGNMENT_MIX` names several and so names
 * none. Returned as the bare tag, because that is what an owner is keyed on —
 * passing the whole subject instead squashes to `CONSIGNMENTCULT`, matches no
 * owner, and sends the line to whoever takes unattributed. Every invoice that
 * had been carefully tagged then landed under one owner and the per-owner
 * split, the entire point of the module, was silently inert.
 *
 * @example
 *   readOwnerTag('CONSIGNMENT_CULT'); // 'CULT'
 *   readOwnerTag('SO-00105 CONSIGNMENT_CRU'); // 'CRU'
 *   readOwnerTag('CONSIGNMENT_MIX'); // null — several owners, so none
 *
 * @param subject - The subject line, reference number, or line description
 * @returns The tag, or null when there is none or it names several owners
 */
const readOwnerTag = (subject: string | null | undefined) => {
  const found = /CONSIGNMENT[_\s-]*([A-Z]+)/i.exec(subject ?? '');
  const tag = found?.[1]?.toUpperCase() ?? null;

  if (!tag || tag === 'MIX') return null;

  return tag;
};

export default readOwnerTag;
