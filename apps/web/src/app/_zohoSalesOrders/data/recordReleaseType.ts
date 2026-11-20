import { client } from '@/database/client';
import tableReady from '@/app/_distribution/utils/tableReady';

/**
 * Keep the type a sales order was released as
 *
 * A type chosen on the release screen is already stored; one the order
 * answered for itself (a PCO, a non-consignment customer, a tagged City Drinks
 * order) is written here so the invoice and the Distribution page can read it.
 * Never overwrites a type someone chose.
 *
 * @param salesOrderId - Our sales order
 * @param releaseType - The type resolved at release
 * @param userId - Who released it
 */
const recordReleaseType = async (
  salesOrderId: string,
  releaseType: string,
  userId: string,
) => {
  if (!(await tableReady('zoho_so_release_types'))) return;

  await client`
    INSERT INTO zoho_so_release_types (sales_order_id, release_type, set_by, set_at)
    VALUES (${salesOrderId}, ${releaseType}, ${userId}, now())
    ON CONFLICT (sales_order_id) DO NOTHING
  `;
};

export default recordReleaseType;
