/**
 * An email address as it may appear in a log: enough to tell which mailbox, not
 * enough to read it off
 *
 * @example
 *   maskEmail('jane.doe@example.com'); // 'j***@example.com'
 *
 * @param email - The address, if any
 * @returns The masked address, or null
 */
const maskEmail = (email: string | null | undefined) => {
  if (!email) return null;
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
};

export default maskEmail;
