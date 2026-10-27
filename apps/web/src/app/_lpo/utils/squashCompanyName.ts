/** Registered suffixes and filler words stripped from the end of a name */
const SUFFIX =
  /(fze|fzc|fzco|llc|lc|ltd|limited|inc|gmbh|sa|srl|bv|plc|spc|co|company|trading|general|group|holdings)$/;

/**
 * A company name reduced to the part anyone would say out loud
 *
 * "CD General L.L.C" and "C D General Trading L.L.C" are the same company and
 * neither contains the other — "Trading" sits in the middle. So the letters are
 * squashed together and the registered suffixes stripped off the end,
 * repeatedly: both become "cdgeneral".
 *
 * @example
 *   squashCompanyName('C D General Trading L.L.C. - S.P.C'); // 'cdgeneral'
 */
const squashCompanyName = (value: string) => {
  let key = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  let previous = '';

  while (key !== previous && key.length > 3) {
    previous = key;
    key = key.replace(SUFFIX, '');
  }

  return key;
};

export default squashCompanyName;
