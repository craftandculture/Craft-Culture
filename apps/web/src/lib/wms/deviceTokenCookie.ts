/**
 * Cookie that carries the warehouse device token after a device first opens a
 * WMS link with `?device_token=`. Middleware swaps the query token for this
 * httpOnly cookie and redirects to the clean URL, so the token leaves the
 * address bar, history and referrers. Edge-safe: constants only.
 */
export const WMS_DEVICE_COOKIE = 'cc_wms_device';

/** Header a device (or script) may send instead of the cookie */
export const WMS_DEVICE_HEADER = 'x-device-token';

/** How long a device stays signed in before it must open its link again */
export const WMS_DEVICE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
