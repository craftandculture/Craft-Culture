import db from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

const pricingModelsGetMany = adminProcedure.query(async () => {
  const pricingModels = await db.query.pricingModels.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    with: {
      sheet: true,
    },
  });

  return pricingModels;
});

export default pricingModelsGetMany;
