'use client';

import StepsTracker from './StepsTracker';
import partnerShipmentSteps from '../utils/partnerShipmentSteps';

export interface PartnerShipmentTrackerProps {
  status: string;
  reachedAt: Record<string, string>;
  atd: Date | string | null;
  eta: Date | string | null;
}

/**
 * Where a wine partner's inbound shipment is, step by step, with the date
 * each step was reached
 */
const PartnerShipmentTracker = ({ status, reachedAt, atd, eta }: PartnerShipmentTrackerProps) => {
  const { steps, current } = partnerShipmentSteps(status, reachedAt, atd, eta);
  return <StepsTracker steps={steps} current={current} />;
};

export default PartnerShipmentTracker;
