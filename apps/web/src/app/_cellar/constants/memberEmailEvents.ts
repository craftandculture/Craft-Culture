/**
 * The Loops templates a member email can use, all in the approved house style
 * (designed and tested in ~/Downloads/private-cellar-emails)
 */
export const MEMBER_EMAIL_TEMPLATES = {
  cellarUpdate: 'cmvp9kyv905nt0j3b1gx0a9e7',
  cellarWines: 'cmvp9ptgh03x90j2n0ukvbauc',
  cellarDelivery: 'cmvp9rv5x05u90j57dpushfrh',
  cellarStatement: 'cmvp9ub4c05zs0j52ssgyx3vi',
  cellarInvite: 'cmvpam98z001p0j2e1y9tupl1',
} as const;

export type MemberEmailTemplate = keyof typeof MEMBER_EMAIL_TEMPLATES;

interface MemberEmailRule {
  template: MemberEmailTemplate;
  /** Asks the member to do something, so it is never held back by the cap */
  action: boolean;
  /** Account, payment or delivery: cannot be switched off by the member */
  essential: boolean;
  /** Several on one day become one email, sent at the next merge slot */
  merge?: boolean;
}

/**
 * The member events that may send an email. Everything else is in-app only.
 *
 * Not emailed, by design: anything the member has just done themselves
 * (reserving, offering wine for sale, confirming a delivery). The screen
 * already told them; the cellar timeline keeps the record. Delivery stages
 * other than Collected stay in-app too: City Drinks contacts the member for
 * the final delivery.
 *
 * Ported from emailPolicy.mjs, where every rule ran against 16 scenarios.
 */
export const MEMBER_EMAIL_EVENTS = {
  invited: { template: 'cellarInvite', action: true, essential: true },
  applicationReceived: { template: 'cellarUpdate', action: false, essential: true },
  finishSettingUp: { template: 'cellarUpdate', action: true, essential: true },
  applicationDeclined: { template: 'cellarUpdate', action: false, essential: true },
  cellarReady: { template: 'cellarUpdate', action: false, essential: true },
  membershipActive: { template: 'cellarUpdate', action: false, essential: true },
  membershipChanged: { template: 'cellarUpdate', action: false, essential: true },
  deliveryQuoted: { template: 'cellarWines', action: true, essential: true },
  deliveryQuoteReminder: { template: 'cellarWines', action: true, essential: true },
  deliverySentBack: { template: 'cellarUpdate', action: true, essential: true },
  deliveryCancelled: { template: 'cellarUpdate', action: false, essential: true },
  deliveryChanged: { template: 'cellarWines', action: false, essential: true },
  deliveryCollected: { template: 'cellarDelivery', action: false, essential: true, merge: true },
  deliveryUnreachable: { template: 'cellarUpdate', action: true, essential: true },
  ukBondReceived: { template: 'cellarWines', action: false, essential: false, merge: true },
  ukMoveQuoted: { template: 'cellarWines', action: true, essential: true },
  ukMoveSentBack: { template: 'cellarUpdate', action: true, essential: true },
  ukMoveShipped: { template: 'cellarUpdate', action: false, essential: false },
  ukMoveArrived: { template: 'cellarWines', action: false, essential: false, merge: true },
  wineArrived: { template: 'cellarWines', action: false, essential: false, merge: true },
  purchaseComplete: { template: 'cellarWines', action: false, essential: true },
  reservationLapsing: { template: 'cellarWines', action: true, essential: true },
  reservationEnded: { template: 'cellarWines', action: false, essential: true },
  sourcingOffer: { template: 'cellarWines', action: true, essential: false },
  allocationOpen: { template: 'cellarWines', action: false, essential: false },
  allocated: { template: 'cellarWines', action: true, essential: false },
  listingSentBack: { template: 'cellarUpdate', action: true, essential: false },
  wineSold: { template: 'cellarWines', action: false, essential: false, merge: true },
  proceedsPaid: { template: 'cellarUpdate', action: false, essential: true },
  sharedAccessInvite: { template: 'cellarUpdate', action: true, essential: true },
  invoiceDue: { template: 'cellarUpdate', action: true, essential: true },
  statement: { template: 'cellarStatement', action: false, essential: false },
} as const satisfies Record<string, MemberEmailRule>;

export type MemberEmailKind = keyof typeof MEMBER_EMAIL_EVENTS;

/** At most this many update emails a member receives in a Gulf day; actions are never held */
export const MEMBER_EMAIL_DAILY_CAP = 2;

/** Gulf hours at which mergeable updates are sent, so a day's events combine */
export const MEMBER_EMAIL_MERGE_HOURS = [12, 17];

/** No member email is sent from 21:00 to 08:00 Gulf time */
export const MEMBER_EMAIL_QUIET_FROM_HOUR = 21;
export const MEMBER_EMAIL_QUIET_UNTIL_HOUR = 8;

/** A merged email lists at most this many wines; the rest are summarised in a line */
export const MEMBER_EMAIL_LIST_CAP = 8;
