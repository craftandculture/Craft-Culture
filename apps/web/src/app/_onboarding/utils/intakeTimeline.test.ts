import { describe, expect, it } from 'vitest';

import intakeTimeline from './intakeTimeline';

describe('intakeTimeline', () => {
  it('splits shipping to the UAE into flight, arrival, customs and check-in', () => {
    const { steps } = intakeTimeline('forwarder', 'requested', null);
    expect(steps.map((step) => step.value)).toEqual([
      'requested',
      'in_progress',
      'arriving_uk',
      'in_transit',
      'arrived_port',
      'customs_clearance',
      'at_warehouse',
      'in_cellar',
    ]);
  });

  it('puts a shipment in customs at Clearing customs, with the dates it reached each step', () => {
    const { steps, current } = intakeTimeline(
      'forwarder',
      'shipping_uae',
      {
        status: 'customs_clearance',
        reachedAt: {
          booked: '2026-10-20T08:00:00.000Z',
          picked_up: '2026-10-24T08:00:00.000Z',
          in_transit: '2026-10-29T08:00:00.000Z',
          arrived_port: '2026-11-01T08:00:00.000Z',
          customs_clearance: '2026-11-02T08:00:00.000Z',
        },
      },
      new Date('2026-10-19T12:00:00.000Z'),
    );
    expect(steps[current]?.label).toBe('Clearing customs');
    expect(steps.map((step) => step.date?.slice(0, 10) ?? null)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-24',
      '2026-10-29',
      '2026-11-01',
      '2026-11-02',
      null,
      null,
    ]);
  });

  it('starts the UAE leg at its first step when the team set the stage by hand', () => {
    const { steps, current } = intakeTimeline('uk_bond', 'shipping_uae', null);
    expect(steps[current]?.value).toBe('in_transit');
  });

  it('keeps the single in-bond move for wine already in the UAE', () => {
    const { steps, current } = intakeTimeline('uae', 'shipping_uae', { status: 'customs_clearance', reachedAt: {} });
    expect(steps.map((step) => step.value)).toEqual(['requested', 'in_progress', 'shipping_uae', 'in_cellar']);
    expect(steps[current]?.label).toBe('Moving in bond to our warehouse');
  });
});
