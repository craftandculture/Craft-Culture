import { desc, eq } from 'drizzle-orm';

import { PEGGED } from '@/app/_logistics/utils/resolveFxToUsd';
import db from '@/database/client';
import { salesQuotes } from '@/database/schema';

export interface QuotedPrice {
  /** What we offered, per bottle, in the order's currency */
  aed: number;
  quoteRef: string;
  quotedAt: Date | null;
}

/** The dirham is pegged, so quote-to-order comparison is arithmetic */
const AED_PER_USD = 1 / (PEGGED.AED ?? 0.2723);

/** Names match on their letters, so "C D General Trading L.L.C. - S.P.C" meets "CD General" */
const squash = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * What we quoted this client, per wine
 *
 * An LPO states a price per bottle and a quote agreed one. Nothing compared
 * them, and a silent disagreement is money: a client keying last month's price,
 * or ours moving after the offer went out, both look like an ordinary order
 * that adds up perfectly against itself.
 *
 * Only published quotes count — a draft is not an offer anyone made. The most
 * recently published wins, since that is the price the client was last given.
 *
 * @param client - The client as the LPO names them
 * @returns Quoted price per LWIN18, in AED
 */
const findQuotedPrices = async (client: string | null) => {
  const quoted = new Map<string, QuotedPrice>();

  if (!client) return quoted;

  const wanted = squash(client);

  if (!wanted) return quoted;

  const rows = await db
    .select({
      quoteRef: salesQuotes.quoteRef,
      client: salesQuotes.client,
      clientCompany: salesQuotes.clientCompany,
      lines: salesQuotes.lines,
      publishedAt: salesQuotes.publishedAt,
    })
    .from(salesQuotes)
    .where(eq(salesQuotes.status, 'published'))
    .orderBy(desc(salesQuotes.publishedAt));

  for (const row of rows) {
    /*
      Either name may be the one the LPO uses, and neither is written the same
      way twice — "C D General Trading L.L.C. - S.P.C" against "CD General
      Trading". Compared on letters alone, and only when one contains the
      other, so two different clients cannot collide.
    */
    const names = [row.client, row.clientCompany]
      .filter((name): name is string => Boolean(name))
      .map(squash);

    const isThisClient = names.some(
      (name) => name.includes(wanted) || wanted.includes(name),
    );

    if (!isThisClient) continue;

    for (const line of row.lines ?? []) {
      if (!line.lwin18) continue;
      // Rows are newest first, so the first price seen is the current one
      if (quoted.has(line.lwin18)) continue;

      const aed =
        line.baed && line.baed > 0
          ? line.baed
          : line.busd && line.busd > 0
            ? line.busd * AED_PER_USD
            : null;

      if (aed == null) continue;

      quoted.set(line.lwin18, {
        aed,
        quoteRef: row.quoteRef,
        quotedAt: row.publishedAt,
      });
    }
  }

  return quoted;
};

export default findQuotedPrices;
