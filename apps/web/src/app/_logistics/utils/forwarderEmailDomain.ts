/** Mail providers anyone can sign up to, which say nothing about the company */
const PUBLIC_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'hotmail.co.uk',
  'live.com',
  'yahoo.com',
  'yahoo.co.uk',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
]);

/**
 * The company domain of a forwarder's email address
 *
 * Used to recognise a forwarder from any of its people. Public mail providers
 * return null: two forwarders both writing from gmail.com are not one company.
 *
 * @example
 *   forwarderEmailDomain('Anna@Hillebrand.com'); // 'hillebrand.com'
 *   forwarderEmailDomain('someone@gmail.com'); // null
 *
 * @param email - Any email address
 * @returns The lower-case domain, or null when it is missing or public
 */
const forwarderEmailDomain = (email: string | null | undefined) => {
  const domain = email?.trim().toLowerCase().split('@')[1];

  return domain && domain.includes('.') && !PUBLIC_DOMAINS.has(domain) ? domain : null;
};

export default forwarderEmailDomain;
