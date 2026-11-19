/**
 * Whether a distributor contact receives warehouse updates first-hand: the
 * people who receive goods, read from the role typed on the contact
 *
 * @example
 *   isLogisticsRole('Logistics'); // true
 *   isLogisticsRole('Warehouse supervisor'); // true
 *   isLogisticsRole('Purchasing'); // false
 *
 * @param role - The role on the partner contact
 */
const isLogisticsRole = (role: string | null | undefined) =>
  /logist|warehouse|receiv|deliver|dispatch|store ?keep/.test(role?.toLowerCase() ?? '');

export default isLogisticsRole;
