import { client } from '@/database/client';

/**
 * Every wine we hold in stock under a real LWIN, with the register's name for it
 *
 * Read once per matching run, so a wine the register lists twice is filed
 * under the code our stock already uses rather than starting a second one.
 *
 * @returns LWIN7 and register name, one row per wine
 */
const getHeldWineNames = async () =>
  client<{ lwin7: string; name: string }[]>`
    SELECT DISTINCT held.lwin7, w.display_name AS name
    FROM (
      SELECT left(replace(lwin18, '-', ''), 7) AS lwin7
      FROM wms_stock
      WHERE lwin18 ~ '^[1-8][0-9]{6}-?[0-9]{4}-?[0-9]{2}-?[0-9]{5}$'
    ) held
    JOIN lwin_wines w ON w.lwin = held.lwin7
  `;

export default getHeldWineNames;
