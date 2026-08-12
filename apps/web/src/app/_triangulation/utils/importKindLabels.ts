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
      'Stock C&C holds for the owner, from shipment packing lists. Add a new import each time a shipment lands — quantities accumulate.',
    behaviour: 'flow',
    side: 'cc',
    defaultUnit: 'case',
    cadence: 'On each shipment',
  },
  cc_sales_to_cd: {
    label: 'C&C sales to City Drinks',
    shortLabel: 'Sold to CD',
    description:
      'Zoho export with invoice detail for everything invoiced to City Drinks.',
    behaviour: 'flow',
    side: 'cc',
    defaultUnit: 'case',
    cadence: 'Monthly',
  },
  cc_count: {
    label: 'C&C physical count',
    shortLabel: 'C&C counted',
    description:
      "C&C's own stock position, compared against the calculated one. Sync it live from the WMS rather than uploading a sheet; upload only for a count taken outside the system.",
    behaviour: 'snapshot',
    side: 'cc',
    defaultUnit: 'case',
    cadence: 'Sync any time · count quarterly',
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
