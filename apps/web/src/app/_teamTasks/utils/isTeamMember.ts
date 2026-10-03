/** The domain every C&C staff account signs in with */
const STAFF_DOMAIN = '@craftculture.xyz';

/**
 * Whether a user is on the C&C team and may see Team Tasks
 *
 * Role alone is not enough: some partners hold admin logins. The team is staff
 * roles (admin or warehouse) signed in with a C&C address.
 *
 * @example
 *   isTeamMember({ role: 'wms_operator', email: 'jo@craftculture.xyz' }); // true
 *
 * @param user - The signed-in user, if any
 * @returns True for admin or warehouse users with a C&C email address
 */
const isTeamMember = (user: { role: string; email: string } | null | undefined) =>
  Boolean(
    user &&
      (user.role === 'admin' || user.role === 'wms_operator') &&
      user.email.trim().toLowerCase().endsWith(STAFF_DOMAIN),
  );

export default isTeamMember;
