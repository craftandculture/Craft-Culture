import parseWineInfoResponse from './parseWineInfoResponse';
import winelabsFetch from './winelabsFetch';

/**
 * Wine Labs details for a wine: names, region, colour and drinking window
 *
 * @param lwin - An LWIN7, or an LWIN11 for one vintage's drinking window
 * @returns The details, or null when Wine Labs cannot map the wine
 */
const getWineInfo = async (lwin: string) =>
  parseWineInfoResponse(await winelabsFetch('wine_info', { lwin }));

export default getWineInfo;
