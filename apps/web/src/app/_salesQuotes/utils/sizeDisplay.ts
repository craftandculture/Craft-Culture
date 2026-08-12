/**
 * Format a bottle volume in centilitres for display.
 *
 * @example
 *   sizeDisplay(75); // '75cl'
 *   sizeDisplay(150); // '1.5L'
 *
 * @param cl - Bottle volume in centilitres
 * @returns The display string
 */
const sizeDisplay = (cl: number) => {
  const volume = cl || 75;
  return volume >= 100 ? `${Number((volume / 100).toFixed(2))}L` : `${volume}cl`;
};

export default sizeDisplay;
