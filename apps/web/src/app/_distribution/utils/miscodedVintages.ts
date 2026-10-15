/**
 * Wines whose code carries the wrong vintage
 *
 * A different fault from a duplicate and fixed differently: nothing is merged,
 * because there is only one wine. The code itself is wrong, so the correction
 * re-keys it — and that changes which lot a bottle belongs to, which is why it
 * is confirmed separately rather than folded into a merge nobody reads.
 */
const MISCODED_VINTAGES: {
  wine: string;
  codedAs: number;
  actually: number;
}[] = [
  { wine: 'Racines Wenzlau', codedAs: 2020, actually: 2022 },
  { wine: 'Gheppio', codedAs: 2021, actually: 2020 },
];

export default MISCODED_VINTAGES;
