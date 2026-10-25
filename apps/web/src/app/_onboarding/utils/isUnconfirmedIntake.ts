/**
 * A box ticked on the application, not a transfer anyone has asked for
 *
 * The application asks where a collector's wine is, and every option ticked
 * was saved as a transfer request. Ihab Toma ticked six, none with a holder,
 * cases or note, and his cellar showed six trackers stuck at "Request
 * received" for wine he had not asked us to move. Until there is something to
 * act on (a holder, a case count, a note, a shipment) or the team moves it on,
 * it is a lead for the cellar team, not something to show the member.
 *
 * @example
 *   isUnconfirmedIntake({ applicationId: 'a…', stage: 'requested', source: 'lcb', holderName: 'LCB', ... }); // true
 *
 * @param intake - The intake row
 * @returns Whether it came from the application with no detail and has not moved
 */
const isUnconfirmedIntake = (intake: {
  applicationId: string | null;
  stage: string;
  source: string;
  holderName: string | null;
  approxCases: number | null;
  note: string | null;
  shipmentId: string | null;
}) =>
  Boolean(intake.applicationId) &&
  intake.stage === 'requested' &&
  !intake.shipmentId &&
  !intake.approxCases &&
  !intake.note &&
  // LCB is filled in automatically for an LCB tick, so it says nothing new
  (!intake.holderName || (intake.source === 'lcb' && intake.holderName === 'LCB'));

export default isUnconfirmedIntake;
