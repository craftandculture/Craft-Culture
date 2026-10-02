/**
 * Round to the cent (or fil), avoiding the 1.005 → 1.00 float trap
 *
 * @example
 *   roundMoney(1.005); // 1.01
 *
 * @param value - Any amount
 * @returns The amount to two decimals
 */
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export default roundMoney;
