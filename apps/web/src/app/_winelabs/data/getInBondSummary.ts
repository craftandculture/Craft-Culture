import getStockWines from '@/app/_winelabs/data/getStockWines';
import db from '@/database/client';
import { winelabsMarket } from '@/database/schema';

/**
 * Where the London in-bond snapshot stands for the wines we hold
 *
 * @returns Counts, and the priced wines largest holding first
 */
const getInBondSummary = async () => {
  const [wines, rows] = await Promise.all([getStockWines(), db.select().from(winelabsMarket)]);

  const byLwin11 = new Map(rows.map((row) => [row.lwin11, row]));
  const checked = wines.flatMap((wine) => {
    const row = byLwin11.get(wine.lwin11);
    return row && row.status !== 'checking' ? [{ ...row, name: wine.name, bottles: wine.bottles }] : [];
  });
  const priced = checked.filter((row) => row.status === 'priced');

  return {
    inStock: wines.length,
    checked: checked.length,
    priced: priced.length,
    unlisted: checked.length - priced.length,
    rows: priced,
  };
};

export type InBondSummary = Awaited<ReturnType<typeof getInBondSummary>>;

export default getInBondSummary;
