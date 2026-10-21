import forwarderEmailDomain from './forwarderEmailDomain';

/**
 * Tidy a forwarder's contacts and work out its email domains
 *
 * One entry per email address (the first kept), blanks dropped, and the
 * company domains the forwarder is recognised by when a quote comes in.
 *
 * @example
 *   cleanForwarderContacts([{ email: 'A@x.com', name: '' }, { email: 'a@x.com' }]);
 *   // { contacts: [{ email: 'a@x.com' }], emailDomains: ['x.com'] }
 *
 * @param contacts - The contacts as entered or imported
 * @returns The contacts to keep and their domains
 */
const cleanForwarderContacts = (
  contacts: { name?: string | null; email: string; phone?: string | null; role?: string | null }[],
) => {
  const seen = new Set<string>();
  const kept = contacts.flatMap((c) => {
    const email = c.email.trim().toLowerCase();
    if (!email || seen.has(email)) return [];
    seen.add(email);

    return [
      {
        email,
        ...(c.name?.trim() ? { name: c.name.trim() } : {}),
        ...(c.phone?.trim() ? { phone: c.phone.trim() } : {}),
        ...(c.role?.trim() ? { role: c.role.trim() } : {}),
      },
    ];
  });

  return {
    contacts: kept,
    emailDomains: [...new Set(kept.map((c) => forwarderEmailDomain(c.email)).filter((d): d is string => !!d))],
  };
};

export default cleanForwarderContacts;
