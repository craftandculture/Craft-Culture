import { sql } from 'drizzle-orm';

import { logisticsJobs, logisticsShipments, partners } from '@/database/schema';

/**
 * Who a shipment is for, and their logo, as SQL columns for a shipment list
 *
 * An export job or mainland transfer is for its client; any other shipment is
 * for its partner. The logo is the partner's: the shipment's own partner first,
 * else the partner whose Zoho contact is the job's Zoho customer, else one
 * whose business name matches the client's. Needs the query to left join
 * logistics_jobs on the shipment.
 */
export const partyNameSql = sql<string | null>`COALESCE(
  NULLIF(${logisticsJobs.clientName}, ''),
  (SELECT ${partners.businessName} FROM ${partners} WHERE ${partners.id} = ${logisticsShipments.partnerId})
)`;

export const partyLogoSql = sql<string | null>`COALESCE(
  (SELECT p.logo_url FROM partners p WHERE p.id = ${logisticsShipments.partnerId} AND p.logo_url IS NOT NULL),
  (SELECT p.logo_url FROM partners p
    WHERE p.logo_url IS NOT NULL
      AND ((${logisticsJobs.zohoCustomerId} IS NOT NULL AND p.zoho_contact_id = ${logisticsJobs.zohoCustomerId})
        OR (${logisticsJobs.clientName} IS NOT NULL AND lower(p.business_name) = lower(${logisticsJobs.clientName})))
    ORDER BY (p.zoho_contact_id = ${logisticsJobs.zohoCustomerId}) DESC NULLS LAST
    LIMIT 1)
)`;
