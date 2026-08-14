/** Wine stem, vintage, pack, millilitres */
const SHAPE = /^(.+)-(\d{4})-(\d{2})-(\d{5})$/;

/**
 * What one code gets wrong against another, field by field
 *
 * Two eighteen-character codes differing in one digit are indistinguishable at
 * a glance, and the digit that differs decides whether something is a typo, a
 * different vintage or a different wine. Told only that a code is wrong,
 * someone corrects the field they happen to notice — the pack — and leaves the
 * vintage, then cannot see why the tool still refuses it.
 *
 * @example
 *   lwinDifferences('2197113-2020-06-00750', '2197113-2023-06-00750');
 *   // ['vintage 2020 not 2023']
 *
 * @param code - The code as it stands
 * @param target - The code it should be
 * @returns One phrase per differing field, empty when they agree
 */
const lwinDifferences = (
  code: string | null | undefined,
  target: string | null | undefined,
) => {
  const from = code ? SHAPE.exec(code.trim()) : null;
  const to = target ? SHAPE.exec(target.trim()) : null;

  if (!from || !to) return code && target ? ['not in the standard shape'] : [];

  const notes: string[] = [];

  if (from[1] !== to[1]) notes.push(`wine ${from[1]} not ${to[1]}`);
  if (from[2] !== to[2]) notes.push(`vintage ${from[2]} not ${to[2]}`);

  if (from[3] !== to[3]) {
    const pack = Number(from[3]);

    notes.push(
      pack > 24
        ? `pack ${from[3]} — no case holds that many, ${to[3]} is meant`
        : `pack ${from[3]} not ${to[3]}`,
    );
  }

  if (from[4] !== to[4]) {
    notes.push(`${Number(from[4])}ml not ${Number(to[4])}ml`);
  }

  return notes;
};

export default lwinDifferences;
