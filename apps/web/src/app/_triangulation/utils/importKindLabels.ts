import type { TriImportKind } from '../schemas/triangulationSchemas';

export interface ImportKindMeta {
  label: string;
  shortLabel: string;
  description: string;
  /** Flows accumulate over time; snapshots are point-in-time counts */
  behaviour: 'flow' | 'snapshot';
  /** Which side of the triangulation the input describes */
  side: 'cc' | 'cd' | 'owner';
  /** Default unit for files of this kind before column mapping overrides it */
  defaultUnit: 'bottle' | 'case';
  cadence: string;
  /** What this input does to the figures, in one line */
  effect: string;
}

/**
 * Display metadata for the triangulation inputs
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
    effect: 'Adds to what C&C has received',
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
    effect: 'Moves bottles out of C&C and into City Drinks',
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
    effect: 'Point-in-time check against the calculated C&C position',
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
    effect: 'Reduces what City Drinks hold',
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
    effect: 'Point-in-time check against the calculated City Drinks position',
  },
  owner_invoice: {
    label: 'Owner invoice to C&C',
    shortLabel: 'Billed to us',
    description:
      "What the wine's owner has invoiced us for — Cru, Cult, Crurated, Rare. Upload their invoice for the consignment lines they have billed.",
    behaviour: 'flow',
    side: 'owner',
    defaultUnit: 'bottle',
    cadence: 'As each owner bills',
    effect: 'Shows what has been settled against what City Drinks sold',
  },
};

export default importKindLabels;
