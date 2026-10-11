import { describe, expect, it } from 'vitest';

import buildRunQueue from './buildRunQueue';
import type { CleanupAction } from './planSkuCleanup';

const act = (over: Partial<CleanupAction>): CleanupAction => ({
  id: 'x',
  itemId: null,
  name: 'Wine',
  sku: '',
  kind: 'retire',
  toName: null,
  toSku: null,
  canonical: null,
  reason: '',
  blocked: null,
  stockExplorerName: null,
  create: null,
  dependsOn: null,
  ...over,
});

describe('buildRunQueue', () => {
  const retire = act({ id: 'old', kind: 'retire', replacedBy: 'VODALT700B-0000-06-00700' });
  const create = act({ id: 'new:VODALT700B-0000-06-00700', kind: 'create', canonical: 'VODALT700B-0000-06-00700' });
  const lone = act({ id: 'gone', kind: 'retire' });

  it('puts each replacement straight after the item it replaces, even if not selected', () => {
    const { queue } = buildRunQueue([lone, retire, create], new Set(['old', 'gone']), new Set());
    expect(queue.map((a) => a.id)).toEqual(['gone', 'old', 'new:VODALT700B-0000-06-00700']);
  });

  it('pilots retire-and-create pairs', () => {
    const { pilot } = buildRunQueue([lone, retire, create], new Set(['old', 'gone', create.id]), new Set());
    expect(pilot.map((a) => a.id)).toEqual(['old', 'new:VODALT700B-0000-06-00700']);
  });

  it('creates the replacement for an item already retired', () => {
    const { queue } = buildRunQueue([create], new Set([create.id]), new Set());
    expect(queue.map((a) => a.id)).toEqual([create.id]);
  });
});
