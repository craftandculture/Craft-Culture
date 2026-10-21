import normaliseCountry from './normaliseCountry';

export interface ForwarderSheetRow {
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  modes: string[];
  originCountries: string[];
  notes: string | null;
}

type Field = 'name' | 'contactName' | 'email' | 'phone' | 'role' | 'modes' | 'countries' | 'notes';

/** Header words that mark each column, checked in order so "contact email" is an email */
const HEADERS: [Field, RegExp][] = [
  ['email', /e-?mail/],
  ['phone', /phone|tel|mobile|whatsapp/],
  ['contactName', /contact|person|attention|attn/],
  ['role', /role|title|position|department/],
  ['modes', /mode|service|freight type/],
  ['countries', /countr|origin|lane|region|collect/],
  ['notes', /note|comment/],
  ['name', /forwarder|company|agent|supplier|carrier|name/],
];

const MODE_WORDS: [string, RegExp][] = [
  ['air', /\bair/],
  ['sea_fcl', /fcl|full container/],
  ['sea_lcl', /lcl|groupage|shared/],
  ['road', /road|truck|land/],
];

const cell = (value: unknown) => (value == null ? '' : String(value).trim());

const split = (text: string) =>
  text
    .split(/[,;/\n]| and /i)
    .map((t) => t.trim())
    .filter(Boolean);

/**
 * Read a forwarder list from a spreadsheet or pasted rows
 *
 * The first row with a forwarder or company column and another beside it is
 * the header (a title row above it is skipped); its
 * other columns are recognised by their usual names (email, phone, contact,
 * role, modes, countries, notes) in any order. Each later row is one contact.
 * A row with no company carries on the company above it, as lists often leave
 * it blank under a merged cell. "Sea" alone counts as both container types.
 *
 * @example
 *   parseForwarderSheet([['Forwarder', 'Email'], ['Hillebrand', 'ops@hillebrand.com']]);
 *   // [{ name: 'Hillebrand', email: 'ops@hillebrand.com', ... }]
 *
 * @param grid - Rows of cells, as read from the sheet or the pasted text
 * @returns One row per contact, and the header found (null if none was)
 */
const parseForwarderSheet = (grid: unknown[][]) => {
  // A header names the company column and at least one other, unlike a title row above it
  const headerIndex = grid.findIndex(
    (row) =>
      row.filter((c) => cell(c)).length >= 2 &&
      row.some((c) => /forwarder|company|agent|carrier|supplier/i.test(cell(c))),
  );

  if (headerIndex === -1) return { rows: [] as ForwarderSheetRow[], header: null };

  const header = grid[headerIndex]!.map((c) => cell(c).toLowerCase());
  const columnOf = new Map<Field, number>();
  header.forEach((h, i) => {
    const field = HEADERS.find(([, pattern]) => pattern.test(h))?.[0];
    if (field && !columnOf.has(field)) columnOf.set(field, i);
  });

  const read = (row: unknown[], field: Field) => {
    const i = columnOf.get(field);
    return i == null ? '' : cell(row[i]);
  };

  const rows: ForwarderSheetRow[] = [];
  let company = '';

  for (const row of grid.slice(headerIndex + 1)) {
    company = read(row, 'name') || company;
    const email = read(row, 'email').toLowerCase();
    if (!company || (!email && !read(row, 'contactName') && !read(row, 'phone'))) continue;

    const modeText = read(row, 'modes').toLowerCase();
    const modes = MODE_WORDS.filter(([, p]) => p.test(modeText)).map(([m]) => m);
    if (/\bsea|ocean/.test(modeText) && !modes.includes('sea_fcl') && !modes.includes('sea_lcl')) {
      modes.push('sea_fcl', 'sea_lcl');
    }

    rows.push({
      name: company,
      contactName: read(row, 'contactName') || null,
      email: /\S+@\S+\.\S+/.test(email) ? email : null,
      phone: read(row, 'phone') || null,
      role: read(row, 'role') || null,
      modes,
      originCountries: split(read(row, 'countries')).map(normaliseCountry),
      notes: read(row, 'notes') || null,
    });
  }

  return { rows, header };
};

export default parseForwarderSheet;
