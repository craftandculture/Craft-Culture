export type TriColumnField =
  | 'rawCode'
  | 'rawDescription'
  | 'rawVintage'
  | 'quantity'
  | 'caseConfig'
  | 'unitPrice'
  | 'currency'
  | 'docRef'
  | 'docDate';

export type TriColumnMapping = Partial<Record<TriColumnField, number>>;

/** Header keywords that identify each field, most specific first */
const FIELD_KEYWORDS: Record<TriColumnField, string[]> = {
  rawCode: [
    'w code',
    'wcode',
    'w-code',
    'sku',
    'item code',
    'product code',
    'cd code',
    'item id',
    'code',
    'reference',
    'ref',
  ],
  rawDescription: [
    'product name',
    'item name',
    'description',
    'wine',
    'product',
    'item',
    'name',
  ],
  rawVintage: ['vintage', 'year'],
  quantity: [
    'quantity sold',
    'qty sold',
    'bottles sold',
    'quantity',
    'qty',
    'bottles',
    'cases',
    'units',
    'stock on hand',
    'on hand',
    'count',
  ],
  caseConfig: ['case config', 'bottles per case', 'pack size', 'pack', 'case size'],
  unitPrice: ['unit price', 'price per bottle', 'rate', 'price', 'selling price'],
  currency: ['currency', 'ccy'],
  docRef: ['invoice number', 'invoice no', 'invoice', 'order number', 'document', 'so number'],
  docDate: ['invoice date', 'date', 'sold on', 'transaction date'],
};

/**
 * Pre-fill the import wizard's column mapping from the sheet's headers
 *
 * A best guess that the user confirms, not an assumption — the wizard always
 * shows what was matched so a wrong guess is visible before anything is saved.
 *
 * @param headers - The header row cells, in sheet order
 * @returns A mapping from field to column index for every field it recognised
 */
const guessColumnMapping = (headers: unknown[]) => {
  const normalized = headers.map((header) =>
    typeof header === 'string' ? header.trim().toLowerCase() : '',
  );

  const mapping: TriColumnMapping = {};
  const taken = new Set<number>();
  const fields = Object.keys(FIELD_KEYWORDS) as TriColumnField[];

  // Exact header matches are claimed across every field first. Running the
  // fuzzy pass per-field instead would let "invoice" on docRef swallow an
  // "Invoice Date" column that docDate matches exactly.
  const claim = (field: TriColumnField, index: number) => {
    mapping[field] = index;
    taken.add(index);
  };

  fields.forEach((field) => {
    for (const keyword of FIELD_KEYWORDS[field]) {
      const exact = normalized.findIndex(
        (header, index) => header === keyword && !taken.has(index),
      );

      if (exact !== -1) {
        claim(field, exact);
        return;
      }
    }
  });

  fields.forEach((field) => {
    if (mapping[field] !== undefined) {
      return;
    }

    for (const keyword of FIELD_KEYWORDS[field]) {
      const partial = normalized.findIndex(
        (header, index) =>
          header.includes(keyword) &&
          !taken.has(index) &&
          // A date column is never the document reference, however much
          // "Invoice Date" looks like "Invoice".
          !(field === 'docRef' && header.includes('date')),
      );

      if (partial !== -1) {
        claim(field, partial);
        return;
      }
    }
  });

  return mapping;
};

export default guessColumnMapping;
