/**
 * A copy of an object without the fields that hold no value
 *
 * Drops `null`, `undefined` and blank strings, so an update built from it only
 * fills in or moves values forward and never clears one already stored. Used
 * where a feed (Hillebrand tracking) may simply not send a field.
 *
 * @example
 *   omitEmptyFields({ eta: null, blNumber: 'MSCU123', containerNumber: '' });
 *   // { blNumber: 'MSCU123' }
 *
 * @param fields - The values to write
 * @returns The same values, minus the empty ones
 */
const omitEmptyFields = <T extends Record<string, unknown>>(fields: T) => {
  return Object.fromEntries(
    Object.entries(fields).filter(
      ([, value]) =>
        value !== null &&
        value !== undefined &&
        !(typeof value === 'string' && value.trim() === ''),
    ),
  ) as Partial<T>;
};

export default omitEmptyFields;
