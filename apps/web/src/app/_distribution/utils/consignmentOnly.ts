import { client } from '@/database/client';

/**
 * A filter keeping only consignment lines among the outs
 *
 * Prepaid and outright lines are now read in beside consignment, so that sales
 * of the outlet's own stock have somewhere to land. Positions, balances and
 * derived sales are about consigned stock alone, and keep reading only that.
 * A line written before the type existed was consignment, so NULL counts.
 *
 * Takes whether the column exists, because a read naming a column the
 * migration has not yet added fails the whole query.
 *
 * @example
 *   client`... WHERE m.kind = 'out' ${consignmentOnly(hasTypes)}`;
 *
 * @param hasTypes - Whether `cons_movements.invoice_type` exists
 * @param alias - The alias `cons_movements` goes by in the query
 * @returns An `AND …` fragment, or nothing
 */
const consignmentOnly = (hasTypes: boolean, alias = 'm') =>
  hasTypes
    ? client`AND COALESCE(${client(alias)}.invoice_type, 'consignment') = 'consignment'`
    : client``;

export default consignmentOnly;
