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
