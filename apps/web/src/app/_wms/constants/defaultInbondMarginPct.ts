/**
 * The In Bond margin for a wine with none of its own and an owner with no rate
 *
 * Stated once because the Pricing Manager and the published price list must
 * agree. The catalogue fell back to 0% while the screen used 10%, so wine with
 * no margin set (Raju Shroff's Lafite jeroboams) listed at landed cost: $3,262.75
 * on the Trade Portfolio against $3,625.28 in the Pricing Manager.
 */
const DEFAULT_INBOND_MARGIN_PCT = 10;

export default DEFAULT_INBOND_MARGIN_PCT;
