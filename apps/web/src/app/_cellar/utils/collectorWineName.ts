import displayWineName from '@/app/_wms/utils/displayWineName';

/** Words kept in capitals: initials and the trade's own abbreviations */
const KEEP_UPPER = /^(AJ|JM|JP|JF|DRC|AOC|AOP|IGT|DOC|DOCG|VV|NV|MV|II|III|IV|1ER|GC)$/;

/**
 * A wine's name as a collector reads it
 *
 * Catalogue names are keyed however the supplier sent them: "2023 Bourgogne
 * blanc 'En la Place' Maison Camille Thiriet 75 cl Blanc", "AJ VAONA Nuits St
 * Georges". On a member's statement the vintage and bottle have their own
 * place, so the leading year and the trailing "75 cl Blanc" come off, and a
 * producer keyed in capitals is set in title case. The stored name is not
 * changed.
 *
 * @example
 *   collectorWineName("AJ VAONA Nuits St Georges"); // 'AJ Vaona Nuits St Georges'
 *
 * @param name - The stored product name
 * @returns The name for a collector's statement
 */
const collectorWineName = (name: string) => {
  const trimmed = displayWineName(name)
    // A leading vintage: "2023 Bourgogne blanc …"
    .replace(/^(19|20)\d{2}\s+/, '')
    // A trailing bottle and colour: "… 75 cl Blanc", "… 75cl Rouge 12.5%"
    .replace(/\s+\d+(\.\d+)?\s*(cl|ml|l)\b(\s+(rouge|blanc|ros[eé]|red|white))?(\s+\d+(\.\d+)?%)?\s*$/i, '')
    .trim();

  return trimmed
    .split(/(\s+)/)
    .map((word) =>
      /^[A-ZÀ-Ý'’-]{3,}$/.test(word) && !KEEP_UPPER.test(word)
        ? word.charAt(0) + word.slice(1).toLowerCase()
        : word,
    )
    .join('');
};

export default collectorWineName;
