/** The kind of change an update describes, as members see it tagged */
export type ProductUpdateType = 'feature' | 'improvement' | 'fix';

/** Who an update is for: the Private Cellar, or trade partners */
export type ProductUpdateAudience = 'collector' | 'wine_partner';

/** One changelog item, bundled into the app at build time */
export interface ReleaseNote {
  version: string;
  date: string;
  type: ProductUpdateType;
  hash: string;
  text: string;
  notes: string[];
}

/** An update as a member's timeline shows it */
export interface MemberUpdate {
  id: string;
  type: ProductUpdateType;
  title: string;
  body: string;
  linkPath: string | null;
  publishedAt: Date;
}
