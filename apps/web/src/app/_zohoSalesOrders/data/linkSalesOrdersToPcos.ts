import { sql } from 'drizzle-orm';

/** A PCO number as staff type it into a Zoho order's Reference */
export const PCO_NUMBER_PATTERN = 'PCO-[0-9]{4}-[0-9]+';

/**
 * Store which private client order each Zoho sales order fulfils, and the
 * other way round
 *
 * A PCO raised by the system records its SO; one the team raises by hand in
 * Zoho carries only the PCO number in Reference. Run after every order sync,
 * so a hand-raised order is linked within one sync and past orders are filled
 * on the first run. Never overwrites a link already made (by this, by "Confirm
 * for member" or by "Link to sales order").
 *
 * @example
 *   await linkSalesOrdersToPcos({ db: triggerDb });
 *
 * @param input.db - Database handle (the Trigger.dev one inside a job)
 * @returns How many links each step made
 */
const linkSalesOrdersToPcos = async ({
  db,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
}) => {
  // 1. The PCO already names its SO (raised by the system)
  const byPco = await db.execute(sql`
    UPDATE zoho_sales_orders so
    SET private_client_order_id = pco.id
    FROM private_client_orders pco
    WHERE so.private_client_order_id IS NULL
      AND pco.zoho_salesorder_id = so.zoho_salesorder_id
  `);

  // 2. The SO quotes the PCO number in Reference (raised by hand)
  const byReference = await db.execute(sql`
    UPDATE zoho_sales_orders so
    SET private_client_order_id = pco.id
    FROM private_client_orders pco
    WHERE so.private_client_order_id IS NULL
      AND so.reference_number IS NOT NULL
      AND pco.order_number = upper(substring(so.reference_number from ${PCO_NUMBER_PATTERN}))
  `);

  // 3. The PCO learns its SO, where exactly one SO fulfils it
  const backToPco = await db.execute(sql`
    UPDATE private_client_orders pco
    SET zoho_salesorder_id = so.zoho_salesorder_id
    FROM (
      SELECT private_client_order_id, MIN(zoho_salesorder_id) AS zoho_salesorder_id
      FROM zoho_sales_orders
      WHERE private_client_order_id IS NOT NULL
      GROUP BY private_client_order_id
      HAVING COUNT(*) = 1
    ) so
    WHERE pco.id = so.private_client_order_id
      AND pco.zoho_salesorder_id IS NULL
  `);

  const count = (result: { count?: number; rowCount?: number }) =>
    result?.count ?? result?.rowCount ?? 0;

  return {
    byPco: count(byPco),
    byReference: count(byReference),
    backToPco: count(backToPco),
  };
};

export default linkSalesOrdersToPcos;
