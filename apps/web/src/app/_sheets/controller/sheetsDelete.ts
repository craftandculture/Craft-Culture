import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { sheets } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const sheetsDelete = adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input: { id } }) => {
    await db.delete(sheets).where(eq(sheets.id, id));

    return { success: true };
  });

export default sheetsDelete;
