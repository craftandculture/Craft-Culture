/** Who a signed-in person is to the cellar they are looking at */
export type CellarRole = 'holder' | 'manager' | 'viewer';

/**
 * What a level of access is needed for
 *
 * - `view`: see the cellar, deliveries, purchases and statements
 * - `act`: commit to something — request a delivery, buy, offer for sale
 * - `hold`: the holder's own business — identity documents, contact details,
 *   the membership, and who else has access
 */
export type CellarNeed = 'view' | 'act' | 'hold';

/**
 * Whether a role may do what is asked
 *
 * The single rule the server enforces for shared cellars. A viewer can only
 * look; a manager can act on the holder's behalf but never stands in for
 * them on the holder's own affairs.
 *
 * @example
 *   cellarRoleAllows('manager', 'act'); // true
 *   cellarRoleAllows('manager', 'hold'); // false
 *
 * @param role - The person's role in this cellar
 * @param need - What the action needs
 * @returns True if the role is enough
 */
const cellarRoleAllows = (role: CellarRole, need: CellarNeed) => {
  if (need === 'view') return true;
  if (need === 'act') return role === 'holder' || role === 'manager';
  return role === 'holder';
};

export default cellarRoleAllows;
