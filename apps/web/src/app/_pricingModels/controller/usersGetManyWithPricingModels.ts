import db from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

const usersGetManyWithPricingModels = adminProcedure.query(async () => {
  const usersWithModels = await db.query.users.findMany({
    with: {
      pricingModel: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return usersWithModels;
});

export default usersGetManyWithPricingModels;
