import type { OrderEmailDepartment } from './orderEmailDepartments';

/**
 * The team a distributor contact belongs to, read from the role typed on it
 *
 * @example
 *   contactDepartment('Purchasing'); // 'purchasing'
 *   contactDepartment('Finance / Accounts'); // 'finance'
 *   contactDepartment('Operations Manager'); // null
 *
 * @param role - The role on the partner contact
 * @returns Purchasing, Finance, or null for anyone else
 */
const contactDepartment = (role: string | null | undefined): OrderEmailDepartment | null => {
  const r = role?.toLowerCase() ?? '';
  if (/purchas|procure|buying|buyer/.test(r)) return 'purchasing';
  if (/financ|account|payment/.test(r)) return 'finance';
  return null;
};

export default contactDepartment;
