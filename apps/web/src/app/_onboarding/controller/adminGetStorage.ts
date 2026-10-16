import { staffAdminProcedure } from '@/lib/trpc/procedures';

import getStorageCharges from '../data/getStorageCharges';
import dubaiMonth from '../utils/dubaiMonth';

/** This month's storage per billed member, and whether it has been pushed */
const adminGetStorage = staffAdminProcedure.query(async () => {
  const month = dubaiMonth();
  const rows = await getStorageCharges();

  return {
    month,
    rows: rows.map((row) => ({ ...row, isPushed: row.lastPushedFor === month })),
  };
});

export default adminGetStorage;
