import { TRPCError } from '@trpc/server';

/** City Drinks' SKU format: CDR followed by ten digits */
const CD_SKU = /^CDR\d{10}$/;

/**
 * Normalise a City Drinks SKU as typed, or refuse it
 *
 * Spaces and dashes are dropped and the letters upper-cased, so the ways a
 * code gets typed or pasted ("cdr 0824592587", "CDR-0824592587") all land on
 * the one form their system uses.
 *
 * @example
 *   normalizeDistributorSku('cdr 0824592587'); // 'CDR0824592587'
 *
 * @param value - The SKU as entered
 * @returns The SKU in City Drinks' canonical form
 * @throws TRPCError BAD_REQUEST when it is not a City Drinks SKU
 */
const normalizeDistributorSku = (value: string) => {
  const sku = value.replace(/[\s-]/g, '').toUpperCase();

  if (!CD_SKU.test(sku)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'City Drinks SKUs look like CDR0824592587 (CDR and 10 digits)',
    });
  }

  return sku;
};

export default normalizeDistributorSku;
