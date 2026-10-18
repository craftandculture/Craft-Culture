import type { CellarRole } from './cellarRoleAllows';

export interface GrantForRole {
  role: string;
  status: string;
}

/**
 * Turn a person's access grants for one cellar into their role
 *
 * No grant at all means they reached the cellar the ordinary way — they own
 * it, or the team linked them to it — so they are its holder. An active grant
 * makes them a delegate with that grant's role. Grants that have all been
 * revoked mean access has ended, even if a stale link still resolves.
 *
 * An unrecognised role on an active grant reads as viewer: an unknown value
 * must fail towards less access, not more.
 *
 * @example
 *   resolveCellarRole([]); // 'holder'
 *   resolveCellarRole([{ role: 'manager', status: 'active' }]); // 'manager'
 *
 * @param grants - The person's grants for this cellar
 * @returns Their role, or 'revoked'
 */
const resolveCellarRole = (grants: GrantForRole[]): CellarRole | 'revoked' => {
  const active = grants.find((grant) => grant.status === 'active');

  if (active) return active.role === 'manager' ? 'manager' : 'viewer';

  if (grants.some((grant) => grant.status === 'revoked')) return 'revoked';

  return 'holder';
};

export default resolveCellarRole;
