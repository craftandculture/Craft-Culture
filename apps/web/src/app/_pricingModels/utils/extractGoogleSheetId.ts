const extractGoogleSheetId = (url: string): string | null => {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? (match[1] ?? null) : null;
};

export default extractGoogleSheetId;
