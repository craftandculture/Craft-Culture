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
      'Received into C&C. Synced from WMS receiving; upload a packing list for anything that predates it.',
    behaviour: 'flow',
    side: 'cc',
    defaultUnit: 'case',
    cadence: 'Live from the WMS',
  },
  cc_sales_to_cd: {
    label: 'C&C sales to City Drinks',
    shortLabel: 'Sold to CD',
    description:
      'Invoiced to City Drinks, from Zoho. They trade as C D General Trading — check the name below.',
    behaviour: 'flow',
    side: 'cc',
    defaultUnit: 'case',
    cadence: 'Live from Zoho',
  },
  cc_count: {
    label: 'C&C stock position',
    shortLabel: 'C&C counted',
    description:
      'What C&C actually holds, live from the WMS. Upload only for stock counted outside the system.',
    behaviour: 'snapshot',
    side: 'cc',
    defaultUnit: 'case',
    cadence: 'System live · count quarterly',
  },
  cd_sales: {
    label: 'City Drinks sales to consumers',
    shortLabel: 'CD sold',
    description:
      'Their sales sheet. CD codes resolve to W codes on the Mapping tab.',
    behaviour: 'flow',
    side: 'cd',
    defaultUnit: 'bottle',
    cadence: 'Monthly',
  },
  cd_count: {
    label: 'City Drinks stock on hand',
    shortLabel: 'CD declared',
    description:
      'What they say they hold, checked against received less sold.',
    behaviour: 'snapshot',
    side: 'cd',
    defaultUnit: 'bottle',
    cadence: 'Monthly',
  },
};

export default importKindLabels;
