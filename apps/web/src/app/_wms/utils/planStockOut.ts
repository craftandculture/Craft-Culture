/**
 * What taking bottles or cases out of one stock row does to it
 *
 * The same arithmetic as a split-case pick: loose bottles are used first, then
 * sealed cases are opened, and whatever is left of an opened case becomes
 * single-bottle stock (moveBottlesToSingles). Reserved cases are never
 * touched: only `availableCases` can be taken.
 *
 * @example
 *   planStockOut({ quantityCases: 5, availableCases: 5, openBottles: 0, pack: 6 }, 'bottle', 2);
 *   // { ok: true, casesRemoved: 1, bottlesOut: 2, leftover: 4, openBottlesUsed: 0 }
 *
 * @param stock - The row's sealed cases, unreserved cases, loose bottles and pack
 * @param unit - Whole cases, or bottles
 * @param quantity - How many of that unit
 * @returns The plan, or the reason it cannot be done
 */
const planStockOut = (
  stock: { quantityCases: number; availableCases: number; openBottles: number; pack: number },
  unit: 'case' | 'bottle',
  quantity: number,
) => {
  const pack = Math.max(1, stock.pack);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false as const, error: 'Enter how many to take out.' };
  }

  if (unit === 'case' || pack === 1) {
    if (quantity > stock.availableCases) {
      return {
        ok: false as const,
        error: `Only ${stock.availableCases} of ${stock.quantityCases} can be taken; the rest is reserved for orders.`,
      };
    }
    return { ok: true as const, casesRemoved: quantity, bottlesOut: quantity * pack, leftover: 0, openBottlesUsed: 0 };
  }

  const openBottlesUsed = Math.min(quantity, stock.openBottles);
  const casesRemoved = Math.ceil((quantity - openBottlesUsed) / pack);
  if (casesRemoved > stock.availableCases) {
    return {
      ok: false as const,
      error: `Not enough unreserved here: ${stock.openBottles} loose bottle(s) and ${stock.availableCases} unreserved case(s) of ${pack}.`,
    };
  }
  return {
    ok: true as const,
    casesRemoved,
    bottlesOut: quantity,
    leftover: stock.openBottles + casesRemoved * pack - quantity,
    openBottlesUsed,
  };
};

export default planStockOut;
