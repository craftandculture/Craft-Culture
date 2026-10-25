/**
 * The database URL as pasted, reduced to the bare URL
 *
 * Neon's copy button can include `psql '…'` and quotes, and a pasted value can
 * carry whitespace or a literal "\\n". On 25 Oct 2026 such a paste into
 * Trigger.dev stopped every background job, and its deploys, with "Invalid
 * URL". Both database clients read DB_URL through this.
 *
 * @example
 *   cleanDbUrl("psql 'postgresql://u:p@host/db'"); // 'postgresql://u:p@host/db'
 *
 * @param value - DB_URL as set in the environment
 * @returns The connection URL alone
 */
const cleanDbUrl = (value: string) => {
  return value
    .trim()
    .replace(/^psql\s+/, '')
    .replace(/^DB_URL=/, '')
    .replace(/(\\[nrt])+$/, '')
    .replace(/^['"]|['"]$/g, '')
    .trim();
};

export default cleanDbUrl;
