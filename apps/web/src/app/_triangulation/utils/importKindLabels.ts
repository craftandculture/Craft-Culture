import type { TriImportKind } from '../schemas/triangulationSchemas';

export interface ImportKindMeta {
  label: string;
  shortLabel: string;
  description: string;
  /** Flows accumulate over time; snapshots are point-in-time counts */
  behaviour: 'flow' | 'snapshot';
  /** Which side of the triangulation the input describes */
  side: 'cc' | 'cd';
  /** Default unit for files of this kind before column mapping overrides it */
  defaultUnit: 'bottle' | 'case';
  cadence: string;
}

/**
 * Display metadata for the five triangulation inputs
 *
 * Keeps the wording of each input consistent between the upload cards, the
 * import history and the reconciliation column headers.
 */
const importKindLabels: Record<TriImportKind, ImportKindMeta> = {
  cc_opening: {
    label: 'C&C opening stock',
    shortLabel: 'Received',
    description:
      'Everything received into C&C for the owner. Synced from the WMS receiving ledger, which is where the packing list was keyed in — upload only for a shipment never received in the system.',
    behaviour: 'flow',
    side: 'cc',
    defaultUnit: 'case',
    cadence: 'Live from the WMS',
  },
  cc_sales_to_cd: {
    label: 'C&C sales to City Drinks',
    shortLabel: 'Sold to CD',
    description:
      'Everything invoiced to City Drinks, synced from the Zoho orders the platform already keeps current. Only invoiced orders count.',
    behaviour: 'flow',
    side: 'cc',
    defaultUnit: 'case',
    cadence: 'Live from Zoho',
  },
  cc_count: {
    label: 'C&C physical count',
    shortLabel: 'C&C counted',
    description:
      "Two things: the system position from wms_stock, and the physical count from a WMS cycle count. The gap between them is the warehouse disagreeing with its own records — only a real count can catch that.",
    behaviour: 'snapshot',
    side: 'cc',
    defaultUnit: 'case',
    cadence: 'System live · count quarterly',
  },
  cd_sales: {
    label: 'City Drinks sales to consumers',
    shortLabel: 'CD sold',
    description:
      'City Drinks sales spreadsheet. Uses CD codes, which map to W codes on the Mapping tab.',
    behaviour: 'flow',
    side: 'cd',
    defaultUnit: 'bottle',
    cadence: 'Monthly',
  },
  cd_count: {
    label: 'City Drinks stock on hand',
    shortLabel: 'CD declared',
    description:
      'Stock City Drinks declare on hand, compared against received-minus-sold.',
    behaviour: 'snapshot',
    side: 'cd',
    defaultUnit: 'bottle',
    cadence: 'Monthly',
  },
};

export default importKindLabels;
