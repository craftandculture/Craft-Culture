import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

export interface TriProgrammeRow {
  id: string;
  name: string;
  slug: string;
  /** How this programme's wines are identified: `w_code` or `lwin` */
  identityStrategy: string;
  /** Owner string matched against `wms_stock.owner_name` */
  wmsOwnerMatch: string | null;
  /** Customer string matched against Zoho's contact name */
  zohoCustomerMatch: string | null;
  skuCount: number;
  importCount: number;
}

/**
 * Every consignment programme, with enough to tell them apart on screen
 *
 * The counts are what make an empty programme obvious. Onboarding a client is
 * several steps — create it, point it at a WMS owner and a Zoho customer, seed
 * its wines — and a programme sitting at zero is the readable sign of one of
 * those not having happened, rather than the reconciliation quietly reporting
 * nothing at all.
 */
const adminGetProgrammes = adminProcedure.query(async () => {
  const rows = await client<TriProgrammeRow[]>`
    SELECT
      p.id,
      p.name,
      p.slug,
      p.identity_strategy AS "identityStrategy",
      p.wms_owner_match AS "wmsOwnerMatch",
      p.zoho_customer_match AS "zohoCustomerMatch",
      COALESCE(s.sku_count, 0)::int AS "skuCount",
      COALESCE(i.import_count, 0)::int AS "importCount"
    FROM tri_programmes p
    LEFT JOIN (
      SELECT programme_id, COUNT(*) AS sku_count
      FROM tri_skus WHERE is_active GROUP BY programme_id
    ) s ON s.programme_id = p.id
    LEFT JOIN (
      SELECT programme_id, COUNT(*) AS import_count
      FROM tri_imports GROUP BY programme_id
    ) i ON i.programme_id = p.id
    WHERE p.is_active
    ORDER BY p.name
  `;

  return rows;
});

export default adminGetProgrammes;
