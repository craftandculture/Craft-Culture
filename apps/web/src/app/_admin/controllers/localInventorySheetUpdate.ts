import extractGoogleSheetId from '@/app/_pricingModels/utils/extractGoogleSheetId';

import settingsUpdateController from './settingsUpdateController';

/**
 * Update local inventory Google Sheet configuration
 *
 * @example
 *   await localInventorySheetUpdate({
 *     googleSheetUrl: 'https://docs.google.com/spreadsheets/d/ABC123...',
 *     sheetName: 'Local Wine Inventory'
 *   });
 *
 * @param input - Google Sheet URL and optional name
 * @returns Success status
 */
const localInventorySheetUpdate = async (input: {
  googleSheetUrl: string;
  sheetName?: string;
}) => {
  // Extract Google Sheet ID from URL
  const googleSheetId = extractGoogleSheetId(input.googleSheetUrl);

  if (!googleSheetId) {
    throw new Error('Invalid Google Sheets URL. Could not extract sheet ID.');
  }

  // Save Google Sheet ID to settings
  await settingsUpdateController({
    key: 'localInventorySheetId',
    value: googleSheetId,
  });

  // Save optional sheet name
  if (input.sheetName) {
    await settingsUpdateController({
      key: 'localInventorySheetName',
      value: input.sheetName,
    });
  }

  return {
    success: true,
    googleSheetId,
    message: 'Local inventory sheet updated successfully',
  };
};

export default localInventorySheetUpdate;
