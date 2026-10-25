/**
 * Read a /wine_info response
 *
 * @example
 *   parseWineInfoResponse({ lwin: '1012781', result: { avg_beg_drink_window: 2024, avg_end_drink_window: 2045 } });
 *   // { result: {...}, drinkFrom: 2024, drinkTo: 2045 }
 *
 * @param body - The parsed JSON body
 * @returns The wine's details and drinking window, or null when unmapped
 */
const parseWineInfoResponse = (body: unknown) => {
  if (!body || typeof body !== 'object') return null;
  const result = (body as Record<string, unknown>).result;
  if (!result || typeof result !== 'object') return null;

  const record = result as Record<string, unknown>;
  const year = (value: unknown) => {
    const n = Math.round(Number(value));
    return Number.isFinite(n) && n > 1800 && n < 2200 ? n : null;
  };

  return {
    result: record,
    drinkFrom: year(record.avg_beg_drink_window),
    drinkTo: year(record.avg_end_drink_window),
  };
};

export default parseWineInfoResponse;
