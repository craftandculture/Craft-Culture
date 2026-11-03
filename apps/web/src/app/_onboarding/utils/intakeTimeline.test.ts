import { describe, expect, it } from 'vitest';

import intakeTimeline from './intakeTimeline';

const NOW = new Date('2026-11-03T10:00:00.000Z');

describe('intakeTimeline', () => {
  it('splits shipping to the UAE into flight, arrival, customs, cleared and check-in', () => {
    const { steps } = intakeTimeline('forwarder', 'requested', null);
    expect(steps.map((step) => step.value)).toEqual([
      'requested',
      'in_progress',
      'arriving_uk',
      'in_transit',
      'arrived_port',
      'customs_clearance',
      'cleared',
      'at_warehouse',
      'in_cellar',
    ]);
  });

  it('puts a shipment in customs at Clearing customs, with the dates it reached each step', () => {
    const { steps, current, next } = intakeTimeline(
      'forwarder',
      'shipping_uae',
      {
        status: 'customs_clearance',
        reachedAt: {
          booked: '2026-10-19T09:44:36.242Z',
          picked_up: '2026-10-26T05:40:04.661Z',
          arrived_port: '2026-11-01T08:14:37.457Z',
          customs_clearance: '2026-11-03T05:47:36.623Z',
        },
      },
      new Date('2026-10-19T12:34:50.744Z'),
      NOW,
    );
    expect(steps[current]?.label).toBe('Clearing customs');
    expect(next).toBe('Once cleared, your wine comes straight to our warehouse.');
    // SHP-2026-0030 skipped In transit: ticked, with no date
    expect(steps.map((step) => step.date?.slice(0, 10) ?? null)).toEqual([
      '2026-10-19',
      '2026-10-19',
      '2026-10-26',
      null,
      '2026-11-01',
      '2026-11-03',
      null,
      null,
      null,
    ]);
  });

  it('moves to checking in and counts bottles once the warehouse starts receiving', () => {
    const { steps, current, next } = intakeTimeline(
      'forwarder',
      'shipping_uae',
      { status: 'customs_clearance', reachedAt: {}, bottles: 108, receivedBottles: 36 },
      null,
      NOW,
    );
    expect(steps[current]?.value).toBe('at_warehouse');
    expect(next).toBe('36 of 108 bottles checked into your cellar so far.');
  });

  it('shows the expected arrival only while it is still ahead', () => {
    const ahead = intakeTimeline('forwarder', 'shipping_uae', { status: 'in_transit', reachedAt: {}, eta: '2026-11-05T12:00:00.000Z' }, null, NOW);
    expect(ahead.steps.find((step) => step.value === 'arrived_port')?.expected).toBe('2026-11-05T12:00:00.000Z');

    const passed = intakeTimeline('forwarder', 'shipping_uae', { status: 'in_transit', reachedAt: {}, eta: '2026-11-01T12:00:00.000Z' }, null, NOW);
    expect(passed.steps.find((step) => step.value === 'arrived_port')?.expected).toBeNull();
  });

  it('starts the UAE leg at its first step when the team set the stage by hand', () => {
    const { steps, current } = intakeTimeline('uk_bond', 'shipping_uae', null);
    expect(steps[current]?.value).toBe('in_transit');
  });

  it('keeps the single in-bond move for wine already in the UAE', () => {
    const { steps, current, next } = intakeTimeline('uae', 'shipping_uae', { status: 'customs_clearance', reachedAt: {} });
    expect(steps.map((step) => step.value)).toEqual(['requested', 'in_progress', 'shipping_uae', 'in_cellar']);
    expect(steps[current]?.label).toBe('Moving in bond to our warehouse');
    expect(next).toBe('Your wine is moving in bond to our warehouse.');
  });

  it('says nothing more once the wine is in the cellar', () => {
    const { steps, current, next } = intakeTimeline('forwarder', 'in_cellar', { status: 'delivered', reachedAt: { delivered: '2026-11-04T09:00:00.000Z' } });
    expect(steps[current]?.label).toBe('In your cellar');
    expect(steps[current]?.date?.slice(0, 10)).toBe('2026-11-04');
    expect(next).toBeNull();
  });
});
