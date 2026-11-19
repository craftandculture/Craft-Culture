const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Cases and loose bottles in a few words
 *
 * @example
 *   describeSize(3, 4); // '3 cases + 4 bottles'
 *
 * @param cases - Whole cases
 * @param bottles - Loose bottles
 * @returns The words, or an empty string when both are nothing
 */
const describeSize = (cases = 0, bottles = 0) =>
  [cases && plural(cases, 'case', 'cases'), bottles && plural(bottles, 'bottle', 'bottles')].filter(Boolean).join(' + ');

export default describeSize;
