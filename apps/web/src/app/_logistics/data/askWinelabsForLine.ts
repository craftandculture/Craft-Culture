import { eq } from 'drizzle-orm';

import lwinNameFit from '@/app/_winelabs/utils/lwinNameFit';
import db from '@/database/client';
import { lwinWines } from '@/database/schema';
import matchToLwin from '@/lib/winelabs/matchToLwin';

/** What the register holds for a wine, to name the line once it is matched */
const registerFields = {
  lwin: lwinWines.lwin,
  displayName: lwinWines.displayName,
  producerTitle: lwinWines.producerTitle,
  producerName: lwinWines.producerName,
  wine: lwinWines.wine,
  region: lwinWines.region,
  subRegion: lwinWines.subRegion,
  country: lwinWines.country,
  classification: lwinWines.classification,
};

export type RegisterRecord = Pick<
  typeof lwinWines.$inferSelect,
  'lwin' | 'displayName' | 'producerTitle' | 'producerName' | 'wine' | 'region' | 'subRegion' | 'country' | 'classification'
>;

/**
 * Ask Wine Labs which wine an inbound line is, and how well its answer fits
 *
 * One name search, about 8 credits. The answer is looked up in our LWIN
 * register for its name, producer and region, and the fit is how much of that
 * name the supplier's line carries (see lwinNameFit). Throws when Wine Labs
 * cannot answer, so a caller can stop asking for the rest of a run.
 *
 * @param withProducer - The line's wine name with the producer in front
 * @param productName - The line as the supplier wrote it
 * @param vintage - The vintage, when known
 * @returns Wine Labs' LWIN7, its name, the fit and the register record, or null when it found nothing
 */
const askWinelabsForLine = async (withProducer: string, productName: string, vintage: number | null) => {
  const match = await matchToLwin([withProducer, vintage].filter(Boolean).join(' '));
  if (!match?.lwin7) return null;

  const [record] = await db.select(registerFields).from(lwinWines).where(eq(lwinWines.lwin, match.lwin7)).limit(1);
  const name = record?.displayName ?? match.displayName ?? '';
  return {
    lwin7: match.lwin7,
    name,
    fit: lwinNameFit(`${withProducer} ${productName}`, name || null),
    record: (record ?? null) as RegisterRecord | null,
  };
};

export default askWinelabsForLine;
