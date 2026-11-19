/** The off / shadow / live switch for warehouse updates, set on Order Emails */
export const WAREHOUSE_UPDATE_MODE_SETTING = 'distributor_updates.mode';

/**
 * The distributors that receive warehouse updates and how, as JSON
 * `{ [partnerId]: { picked: 'grouped' | 'immediate', summary: boolean } }`.
 * A distributor not listed receives nothing.
 */
export const WAREHOUSE_UPDATE_PARTNERS_SETTING = 'distributor_updates.partners';

/** How long a cancelled pick list waits before the distributor is told, in case it is re-released */
export const CANCELLED_GRACE_MINUTES = 30;

/** How far back the end-of-day summary looks for open orders */
export const SUMMARY_LOOKBACK_DAYS = 14;
