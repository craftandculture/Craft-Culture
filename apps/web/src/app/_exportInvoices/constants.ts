import type { ExportParty } from './schemas/exportDocumentSchema';

/** The UAE dirham's fixed peg to the dollar */
export const AED_PER_USD = 3.6725;

export const EXPORTER: ExportParty = {
  name: 'Craft and Culture FZE',
  addressLines: ['Fujairah Free Zone', 'Fujairah', 'PO BOX 50365', 'United Arab Emirates'],
  trn: '104621721000003',
};

export const COLLECTION_POINT: ExportParty = {
  name: 'Craft and Culture FZE',
  addressLines: ['Warehouse 1.2 (Duty Free)', 'RAK Port', 'Ras Al Khaimah', 'United Arab Emirates'],
  trn: null,
};

export const DEFAULT_TERMS = 'Ex Works RAK Port, UAE';

export const DEFAULT_DECLARATION =
  'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.';

/** PCO orders are packed in cartons of this many bottles */
export const PCO_CASE_BOTTLES = 3;

/** The only HS codes the platform declares (see `classifyHsCode`) */
export const HS_STILL_WINE = '22042100';
export const HS_SPARKLING_WINE = '22041000';
export const HS_SPIRITS = '22083000';

/** C&C's UK EORI, on every UK import and on its stamp */
export const UK_EORI = 'GB048089787000';

/** The UK EORI company stamp, printed in the signature box of a UK import */
export const UK_EORI_STAMP_URL = 'https://wine.craftculture.xyz/images/cc-stamp-uk-eori.png';

/**
 * The UK bonds C&C collects from
 *
 * `short` goes in the terms of delivery ("Ex Works (LCB Tilbury)"), `address`
 * is the collection address customs see.
 */
export const UK_BONDS = {
  lcbTilbury: { name: 'London City Bond, Tilbury', short: 'LCB Tilbury', address: 'London City Bond, Tilbury, Essex, United Kingdom' },
  lcbBurton: { name: 'London City Bond, Burton Gateway', short: 'LCB Burton', address: 'London City Bond, Burton Gateway, Burton upon Trent, United Kingdom' },
  bbr: { name: 'Berry Bros. & Rudd, Basingstoke', short: 'BBR Basingstoke', address: 'Hamilton Close, Houndmills, Basingstoke RG21 6YB, United Kingdom' },
} as const;

export type UkBondKey = keyof typeof UK_BONDS;

/** What a UK import is shipped for, unless the operator says otherwise */
export const UK_IMPORT_REASON = 'Transfer of own stock — no sale; values stated for customs purposes';
