import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { pricingModels } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import createPricingModelSchema from '../schemas/createPricingModelSchema';

const pricingModelsCreate = adminProcedure
  .input(createPricingModelSchema)
  .mutation(
    async ({
      input: { modelName, sheetId, isDefaultB2C, isDefaultB2B, cellMappings },
    }) => {
      await db.transaction(async (tx) => {
        const sheet = await tx.query.sheets.findFirst({
          where: {
            id: sheetId,
          },
        });

        if (!sheet) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Sheet not found',
          });
        }

        // If setting as default, unset the current default
        if (isDefaultB2C) {
          await tx
            .update(pricingModels)
            .set({ isDefaultB2C: false })
            .where(eq(pricingModels.isDefaultB2C, true));
        }

        if (isDefaultB2B) {
          await tx
            .update(pricingModels)
            .set({ isDefaultB2B: false })
            .where(eq(pricingModels.isDefaultB2B, true));
        }

        // TODO: Validate cell mappings against a random product from the sheet
        // This will be implemented next to ensure the mappings work correctly

        const [pricingModel] = await tx
          .insert(pricingModels)
          .values({
            name: modelName,
            sheetId,
            isDefaultB2C,
            isDefaultB2B,
            cellMappings,
          })
          .returning();

        return pricingModel;
      });
    },
  );

export default pricingModelsCreate;
