import { describe, expect, it } from 'vitest';

import intakeStageFromShipment from './intakeStageFromShipment';
import laterIntakeStage from './laterIntakeStage';

describe('intakeStageFromShipment', () => {
  it('maps the UAE leg of a shipment onto the tracker', () => {
    expect(intakeStageFromShipment('booked')).toBe('in_progress');
    expect(intakeStageFromShipment('in_transit')).toBe('shipping_uae');
    expect(intakeStageFromShipment('customs_clearance')).toBe('shipping_uae');
    expect(intakeStageFromShipment('partially_received')).toBe('shipping_uae');
    expect(intakeStageFromShipment('delivered')).toBe('in_cellar');
  });

  it('implies nothing for a draft or cancelled shipment', () => {
    expect(intakeStageFromShipment('draft')).toBeNull();
    expect(intakeStageFromShipment('cancelled')).toBeNull();
  });
});

describe('laterIntakeStage', () => {
  it('moves a transfer forward to the shipment', () => {
    expect(laterIntakeStage('requested', 'shipping_uae')).toBe('shipping_uae');
  });

  it('never pulls back a stage the team set by hand', () => {
    expect(laterIntakeStage('arriving_uk', 'in_progress')).toBe('arriving_uk');
  });

  it('leaves a closed transfer closed, and an unlinked one as it is', () => {
    expect(laterIntakeStage('closed', 'in_cellar')).toBe('closed');
    expect(laterIntakeStage('in_progress', null)).toBe('in_progress');
  });
});
