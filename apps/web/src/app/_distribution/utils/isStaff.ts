/** The domain every C&C staff account signs in with */
const STAFF_DOMAIN = '@craftculture.xyz';

/**
 * Whether a user is C&C staff rather than merely an admin
 *
 * Admin is not enough for the daily sales view. Partners such as Crurated and
 * OpenCellar are shown the distribution screens, and the day-by-day movement of
 * every owner's wine is ours to read, not theirs. So the check is the role and
 * the company address together.
 *
 * @param user - The signed-in user, if any
 * @returns True only for an admin signed in with a C&C address
 */
const isStaff = (user: { role: string; email: string } | null | undefined) =>
  Boolean(
    user &&
      user.role === 'admin' &&
      user.email.trim().toLowerCase().endsWith(STAFF_DOMAIN),
  );

export default isStaff;
