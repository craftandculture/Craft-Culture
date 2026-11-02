import scoreWineMatch from './scoreWineMatch';

export interface RegisterEntry {
  docRef: string | null;
  wineName: string;
  ownerId: string | null;
}

/** Below this the names share too little to say they are one wine */
const ENOUGH = 0.5;

/**
 * Whose a line on one of our invoices is, according to the Codes tab
 *
 * The register lists every invoice line with its owner. Where every line it
 * lists for an invoice has one owner, that owner holds for the whole invoice —
 * INV-000176 is all Crurated whatever Zoho calls each wine. Where an invoice
 * was mixed (INV-000236 carries C&C, Rare and Cru), the line is matched to the
 * register's row by name, and only a confident match counts.
 *
 * @example
 *   ownerFromRegister(entries, 'INV-000236', 'Bollinger La Grande Annee 2014');
 *   // the Rare owner id
 *
 * @param entries - The register's rows, owners already resolved
 * @param docRef - The invoice the line is on
 * @param lineName - The line's wine as our invoice names it
 * @returns The owner id, or null when the register cannot say
 */
const ownerFromRegister = (
  entries: RegisterEntry[],
  docRef: string | null,
  lineName: string,
) => {
  if (!docRef) return null;

  const onInvoice = entries.filter(
    (entry) => entry.docRef === docRef && entry.ownerId,
  );

  if (onInvoice.length === 0) return null;

  const owners = new Set(onInvoice.map((entry) => entry.ownerId));

  if (owners.size === 1) return onInvoice[0]!.ownerId;

  let best: { ownerId: string | null; score: number } | null = null;

  for (const entry of onInvoice) {
    const { score } = scoreWineMatch(lineName, entry.wineName);

    if (score >= ENOUGH && (!best || score > best.score)) {
      best = { ownerId: entry.ownerId, score };
    }
  }

  return best?.ownerId ?? null;
};

export default ownerFromRegister;
