import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { pricingModels } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const pricingModelsDelete = adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input: { id } }) => {
    await db.delete(pricingModels).where(eq(pricingModels.id, id));

    return { success: true };
  });

export default pricingModelsDelete;
