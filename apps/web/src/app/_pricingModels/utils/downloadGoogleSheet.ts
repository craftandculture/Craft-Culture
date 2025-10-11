const downloadGoogleSheet = async (
  googleSheetId: string,
): Promise<ArrayBuffer> => {
  const exportUrl = `https://docs.google.com/spreadsheets/d/${googleSheetId}/export?format=xlsx`;

  const response = await fetch(exportUrl);

  if (!response.ok) {
    throw new Error('Failed to download Google Sheet');
  }

  return await response.arrayBuffer();
};

export default downloadGoogleSheet;
