import { describe, expect, it } from 'vitest';

import ukMoveSteps from './ukMoveSteps';

const NOW = new Date('2026-11-03T12:00:00.000Z');
const base = {
  shipmentStatus: null,
  createdAt: '2026-11-03T08:00:00.000Z',
  quotedAt: null,
  acceptedAt: null,
  shippedAt: null,
  arrivedAt: null,
  eta: null,
  reachedAt: {},
};

describe('ukMoveSteps', () => {
  it('shows a quoted move at Price ready, dated', () => {
    const { steps, current } = ukMoveSteps({ ...base, status: 'quoted', quotedAt: '2026-11-03T11:45:00.000Z' }, NOW);
    expect(steps[current]?.label).toBe('Price ready');
    expect(steps.slice(0, 2).map((step) => step.date?.slice(0, 10))).toEqual(['2026-11-03', '2026-11-03']);
    expect(steps[2]?.done).toBe(false);
  });

  it('follows the shipment once the move ships', () => {
    const { steps, current } = ukMoveSteps(
      {
        ...base,
        status: 'shipping',
        shipmentStatus: 'customs_clearance',
        shippedAt: '2026-11-05T09:00:00.000Z',
        reachedAt: { arrived_port: '2026-11-07T09:00:00.000Z', customs_clearance: '2026-11-08T09:00:00.000Z' },
      },
      NOW,
    );
    expect(steps[current]?.label).toBe('Clearing customs');
    expect(steps[3]?.date?.slice(0, 10)).toBe('2026-11-05');
    expect(steps[4]?.date?.slice(0, 10)).toBe('2026-11-07');
  });

  it('shows the expected arrival only while it is ahead', () => {
    const ahead = ukMoveSteps({ ...base, status: 'shipping', shipmentStatus: 'in_transit', eta: '2026-11-10T12:00:00.000Z' }, NOW);
    expect(ahead.steps[4]?.expected).toBe('2026-11-10T12:00:00.000Z');
    const late = ukMoveSteps({ ...base, status: 'shipping', shipmentStatus: 'in_transit', eta: '2026-11-01T12:00:00.000Z' }, NOW);
    expect(late.steps[4]?.expected).toBeNull();
  });
});
