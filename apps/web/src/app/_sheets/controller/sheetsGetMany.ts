import db from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

const sheetsGetMany = adminProcedure.query(async () => {
  const allSheets = await db.query.sheets.findMany({
    orderBy: (sheets, { desc }) => [desc(sheets.createdAt)],
  });

  return allSheets;
});

export default sheetsGetMany;
