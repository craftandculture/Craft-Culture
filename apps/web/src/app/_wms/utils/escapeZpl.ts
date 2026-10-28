/**
 * Make text safe to print inside a ZPL field (^FD ... ^FS).
 *
 * ^ starts a command and ~ a control command, so a wine or client name holding
 * either could end the field and run whatever followed on the printer (or just
 * garble the label). Line breaks and other control characters end a field too.
 * Accents are folded to plain letters because the printer's built-in font has
 * none.
 *
 * One definition: each label generator used to keep its own copy, and the
 * copies had drifted (some folded accents, one missed ligatures, none removed
 * line breaks).
 *
 * @example
 *   escapeZpl('Château Mouton^FS~JR'); // 'Chateau Mouton FS JR'
 */
const escapeZpl = (value: string | number | null | undefined) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'AE')
    .replace(/ß/g, 'ss')
    .replace(/[\^~]/g, ' ')

    .replace(/[\u0000-\u001f\u007f]/g, ' ');

export default escapeZpl;
