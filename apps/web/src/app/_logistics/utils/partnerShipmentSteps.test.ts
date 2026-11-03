import { describe, expect, it } from 'vitest';

import partnerShipmentSteps from './partnerShipmentSteps';

const NOW = new Date('2026-11-03T10:00:00.000Z');

describe('partnerShipmentSteps', () => {
  it('ticks skipped steps without a date and dates the ones reached', () => {
    const { steps, current } = partnerShipmentSteps(
      'customs_clearance',
      { booked: '2026-10-20T08:00:00.000Z', picked_up: '2026-10-25T08:00:00.000Z', arrived_port: '2026-11-01T08:00:00.000Z', customs_clearance: '2026-11-03T06:00:00.000Z' },
      null,
      '2026-11-02T12:00:00.000Z',
      NOW,
    );
    expect(steps[current]?.label).toBe('Clearing customs');
    expect(steps.map((step) => [step.done, step.date?.slice(0, 10) ?? null])).toEqual([
      [true, '2026-10-20'],
      [true, '2026-10-25'],
      [true, null],
      [true, '2026-11-01'],
      [true, '2026-11-03'],
      [false, null],
      [false, null],
      [false, null],
    ]);
  });

  it('uses the recorded departure, and shows the expected arrival only while ahead', () => {
    const { steps } = partnerShipmentSteps('in_transit', { in_transit: '2026-10-30T08:00:00.000Z' }, '2026-10-28T12:00:00.000Z', '2026-11-05T12:00:00.000Z', NOW);
    expect(steps[2]?.date?.slice(0, 10)).toBe('2026-10-28');
    expect(steps[3]?.expected).toBe('2026-11-05T12:00:00.000Z');

    const late = partnerShipmentSteps('in_transit', {}, null, '2026-11-01T12:00:00.000Z', NOW);
    expect(late.steps[3]?.expected).toBeNull();
  });
});
