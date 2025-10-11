import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { sheets } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import convertToHyperFormula from '../../_pricingModels/utils/convertToHyperFormula';
import downloadGoogleSheet from '../../_pricingModels/utils/downloadGoogleSheet';
import extractGoogleSheetId from '../../_pricingModels/utils/extractGoogleSheetId';
import uploadSheetSchema from '../schemas/uploadSheetSchema';

const sheetsCreate = adminProcedure
  .input(uploadSheetSchema)
  .mutation(async ({ input: { name, googleSheetUrl } }) => {
    const googleSheetId = extractGoogleSheetId(googleSheetUrl);

    if (!googleSheetId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid Google Sheets URL',
      });
    }

    const buffer = await downloadGoogleSheet(googleSheetId);

    const formulaData = await convertToHyperFormula(buffer);

    const existingSheet = await db.query.sheets.findFirst({
      where: {
        googleSheetId,
      },
    });

    if (existingSheet) {
      const [updatedSheet] = await db
        .update(sheets)
        .set({
          name,
          formulaData,
          updatedAt: new Date(),
        })
        .where(eq(sheets.id, existingSheet.id))
        .returning();

      return updatedSheet;
    }

    const [newSheet] = await db
      .insert(sheets)
      .values({
        name,
        googleSheetId,
        formulaData,
      })
      .returning();

    return newSheet;
  });

export default sheetsCreate;
