/** Resolved label set for a quote's chips, after config defaults are applied. */
export interface QuoteLabels {
  /** drop pack from Format and hide the Case column */
  bottlesOnly: boolean;
  /** Avail column shows the offered quantity rather than free stock */
  offered: boolean;
  /** chip every line with where the wine physically is */
  stockStatus: boolean;
  pcLabel: string;
  whLabel: string;
  ibLabel: string;
  extraCol?: { label: string; multiplier: number };
  gpScenarios?: number[];
}

/** A quote line with every display decision already resolved. */
export interface PreparedLine {
  wine: string;
  vintage: string;
  region: string;
  size: string;
  sizeCl: number;
  mag: boolean;
  oos: boolean;
  promo: boolean;
  pc: boolean;
  repack: boolean;
  loc: string;
  note: string;
  pack: number;
  single: boolean;
  avail: number;
  qty: number;
  maxUnits: number;
  unit: string;
  bottleMode: boolean;
  low: boolean;
  bottleAed: number;
  bottleUsd: number;
  caseAed: number;
  caseUsd: number;
  baseKey: string;
  vintageYear: number;
}

/** A quote line as held in the builder's local editing state. */
export interface QuoteLineDraft {
  lwin18: string;
  wine: string;
  vintage: string;
  size: number;
  pack: number;
  avail: number;
  qty: number;
  busd: number;
  baed?: number;
  cusd?: number;
  caed?: number;
  region: string;
  promo?: boolean;
  pc?: boolean;
  loc?: string;
  note?: string;
  oos?: boolean;
}

/** Header fields and template options being edited in the builder. */
export interface QuoteFormState {
  id?: string;
  slug: string;
  quoteRef: string;
  client: string;
  clientCompany: string;
  contactName: string;
  contactEmail: string;
  eyebrow: string;
  h1: string;
  subtitle: string;
  /** date-only, e.g. "2026-08-26" */
  validUntil: string;
  promoUntil: string;
  orderUnit: 'bottle' | 'case';
  bottlesOnly: boolean;
  offered: boolean;
  stockStatus: boolean;
  pcLabel: string;
  whLabel: string;
  ibLabel: string;
  priceBasis: string;
  title: string;
  /** blank label = no extra column */
  extraColLabel: string;
  extraColMultiplier: number;
  /** comma-separated GP percentages, e.g. "20, 25"; blank = no toggle */
  gpScenarios: string;
}
