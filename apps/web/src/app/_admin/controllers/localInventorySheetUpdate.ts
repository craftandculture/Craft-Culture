import settingsUpdateController from './settingsUpdateController';

/**
 * Extract Google Sheet ID from URL
 *
 * @example
 *   extractGoogleSheetId('https://docs.google.com/spreadsheets/d/ABC123/edit');
 *   // returns 'ABC123'
 *
 * @param url - Google Sheets URL
 * @returns Sheet ID or null if invalid
 */
const extractGoogleSheetId = (url: string) => {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
};

/**
 * Update local inventory Google Sheet configuration
 *
 * Extracts sheet ID from URL and stores in settings.
 *
 * @example
 *   await localInventorySheetUpdate({
 *     googleSheetUrl: 'https://docs.google.com/spreadsheets/d/ABC123/edit',
 *     sheetName: 'My Inventory',
 *   });
 *
 * @param input - Sheet configuration
 * @returns Success status with sheet ID
 */
const localInventorySheetUpdate = async (input: {
  googleSheetUrl: string;
  sheetName?: string;
}) => {
  const googleSheetId = extractGoogleSheetId(input.googleSheetUrl);

  if (!googleSheetId) {
    throw new Error('Invalid Google Sheets URL. Could not extract sheet ID.');
  }

  await settingsUpdateController({
    key: 'localInventorySheetId',
    value: googleSheetId,
  });

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
