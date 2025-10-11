import { TRPCError } from '@trpc/server';

import db from '@/database/client';
import { sheets } from '@/database/schema';
import conflictUpdateSet from '@/database/utils/conflictUpdateSet';
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

    // Use onConflictDoUpdate to handle existing sheets
    const [sheet] = await db
      .insert(sheets)
      .values({
        name: name || googleSheetId,
        googleSheetId,
        formulaData,
      })
      .onConflictDoUpdate({
        target: sheets.googleSheetId,
        set: conflictUpdateSet(sheets, [
          name ? 'name' : 'googleSheetId',
          'formulaData',
          'updatedAt',
        ]),
      })
      .returning();

    return sheet;
  });

export default sheetsCreate;
