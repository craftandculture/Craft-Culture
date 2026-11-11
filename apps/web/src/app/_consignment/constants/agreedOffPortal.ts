/**
 * How an offer recorded from prices agreed away from the portal is known
 *
 * Management records these with adminRecordAgreedPrices. They are saved as
 * open offers so the bottles count against the member's holding and sales
 * draw them down, but the member never asked for them to be listed, so they
 * must never reach the Accept & list queue. The phrase is written into the
 * offer's staff note when it is created and is what every reader matches on:
 * one definition, read and written from here.
 */
export const AGREED_OFF_PORTAL_NOTE = 'from prices agreed away from the portal';

/** What staff are told when they try to decide one */
export const AGREED_OFF_PORTAL_MESSAGE =
  'This price was agreed with the member away from the portal. It is not for listing; ask Management.';
