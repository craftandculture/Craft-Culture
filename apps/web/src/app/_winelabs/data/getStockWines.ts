import lwin11Of from '@/app/_winelabs/utils/lwin11Of';
import { client } from '@/database/client';

/**
 * Every wine and vintage we hold, largest holding first
 *
 * Packs, sizes, owners and bays of one vintage are one wine to Wine Labs, so
 * stock is summed per LWIN11. Lines whose code is not an LWIN18 (spirits,
 * canned wine) cannot be looked up and are left out.
 *
 * @returns Wines in stock with the bottles held
 */
const getStockWines = async () => {
  const rows = await client<
    { lwin18: string; name: string; producer: string | null; bottles: number }[]
  >`
    SELECT lwin18,
           max(product_name) AS name,
           max(producer) AS producer,
           sum(quantity_cases * coalesce(case_config, 1) + open_bottles)::int AS bottles
    FROM wms_stock
    WHERE quantity_cases > 0 OR open_bottles > 0
    GROUP BY lwin18
  `;

  const wines = new Map<
    string,
    { lwin11: string; lwin7: string; vintage: string; name: string; producer: string | null; bottles: number }
  >();
  for (const row of rows) {
    const code = lwin11Of(row.lwin18);
    if (!code) continue;
    const held = wines.get(code.lwin11);
    if (held) {
      held.bottles += row.bottles;
    } else {
      wines.set(code.lwin11, { ...code, name: row.name, producer: row.producer, bottles: row.bottles });
    }
  }

  return [...wines.values()].sort((a, b) => b.bottles - a.bottles);
};

export type StockWine = Awaited<ReturnType<typeof getStockWines>>[number];

export default getStockWines;
