import { lwinPakKeyOf } from '@/app/_wms/utils/lwinPakKey';

import parseZohoSku from './parseZohoSku';

export interface CleanupItem {
  itemId: string;
  name: string;
  sku: string;
  status: 'active' | 'inactive';
  stockOnHand: number;
  productType: string | null;
  createdTime: string;
}

export interface CleanupContext {
  /** Stock Explorer lines by exact LWIN-18: product name and cases */
  stockExplorer: Map<string, { name: string; cases: number }>;
  /** Wine-vintage-size keys held on hand or inbound, any pack */
  heldKeys: Set<string>;
  /** Zoho item ids on a sales order not yet dispatched */
  openOrderItemIds: Set<string>;
  /** Items created this recently are left alone (ISO date) */
  newSince: string;
}

export type CleanupKind = 'add_dashes' | 'retire_duplicate' | 'retire_non_lwin' | 'retire_not_held' | 'review';

export interface CleanupAction {
  itemId: string;
  name: string;
  sku: string;
  kind: CleanupKind;
  /** The SKU it will be given (add_dashes), or renamed to before retiring */
  toSku: string | null;
  canonical: string | null;
  reason: string;
  /** Why it cannot run yet; null when it can */
  blocked: string | null;
  zohoStock: number;
  stockExplorerName: string | null;
  /** The item a retired duplicate gives way to */
  keepItemId: string | null;
  /** Retire the duplicate first: it holds the code this item needs */
  dependsOn: string | null;
}

const SERVICE = /^(storage|repack|transport|monthly|brand development)/i;

const yearsIn = (name: string) => [...name.matchAll(/\b(19[5-9]\d|20[0-3]\d)\b/g)].map((m) => m[1]);

/**
 * Plan the Zoho item-code cleanup: one active item per Stock Explorer code
 *
 * Every LWIN-shaped SKU is matched to its dashed Stock Explorer form.
 * - Alone under its code, a compact or mis-dashed SKU is given the dashes.
 * - Two or more active items under one code: the one holding Zoho stock is
 *   kept (else the one already dashed, else the newest) and the rest retired.
 *   A retired item that holds the dashed code is renamed `…-OLD` first, so
 *   the kept item can take it.
 * - A non-LWIN SKU (brand codes, "HK - …", blanks) is retired. Service lines
 *   are left alone.
 * - A dashed code Stock Explorer does not hold in any pack, with no Zoho
 *   stock, is offered for retirement separately.
 *
 * Nothing that holds Zoho stock or sits on an open sales order is retired,
 * and duplicates whose names give different vintages go to review.
 *
 * @param items - Every Zoho item, active and inactive
 * @param ctx - Stock Explorer, inbound and open-order evidence
 * @returns One action per item that needs one
 */
const planSkuCleanup = (items: CleanupItem[], ctx: CleanupContext) => {
  const actions: CleanupAction[] = [];
  const active = items.filter((i) => i.status === 'active');

  const takenBy = new Map<string, string>();
  for (const i of items) takenBy.set(i.sku.trim().toUpperCase(), i.itemId);

  const groups = new Map<string, CleanupItem[]>();

  const base = (i: CleanupItem, canonical: string | null) => ({
    itemId: i.itemId,
    name: i.name,
    sku: i.sku,
    canonical,
    zohoStock: i.stockOnHand,
    stockExplorerName: canonical ? (ctx.stockExplorer.get(canonical)?.name ?? null) : null,
    toSku: null,
    keepItemId: null,
    dependsOn: null,
  });

  const retireBlock = (i: CleanupItem) =>
    i.stockOnHand !== 0
      ? `Holds ${i.stockOnHand} in Zoho — move it to the kept item first`
      : ctx.openOrderItemIds.has(i.itemId)
        ? 'On a sales order not yet dispatched'
        : null;

  for (const i of active) {
    if (i.productType === 'service' || SERVICE.test(i.name) || SERVICE.test(i.sku)) continue;
    const { canonical, form } = parseZohoSku(i.sku);
    if (!canonical) {
      actions.push({
        ...base(i, null),
        kind: 'retire_non_lwin',
        reason: form === 'blank' ? 'No SKU' : `"${i.sku}" is not a Stock Explorer code`,
        blocked: retireBlock(i),
      });
      continue;
    }
    groups.set(canonical, [...(groups.get(canonical) ?? []), i]);
  }

  for (const [canonical, members] of groups) {
    const se = ctx.stockExplorer.get(canonical);

    if (members.length === 1) {
      const i = members[0]!;
      if (i.sku.trim().toUpperCase() !== canonical) {
        const holder = takenBy.get(canonical);
        actions.push({
          ...base(i, canonical),
          kind: 'add_dashes',
          toSku: canonical,
          reason: se ? `Stock Explorer holds it as ${canonical}` : `Dashed form ${canonical}`,
          blocked: holder && holder !== i.itemId ? 'Another (inactive) item already uses the dashed code' : null,
        });
      } else if (
        !ctx.heldKeys.has(lwinPakKeyOf(canonical)) &&
        i.stockOnHand === 0 &&
        i.createdTime < ctx.newSince
      ) {
        actions.push({
          ...base(i, canonical),
          kind: 'retire_not_held',
          reason: 'Not in Stock Explorer or inbound in any pack, and no Zoho stock',
          blocked: retireBlock(i),
        });
      }
      continue;
    }

    const vintages = new Set(members.map((m) => yearsIn(m.name).join('/')).filter(Boolean));
    const stocked = members.filter((m) => m.stockOnHand !== 0);
    if (vintages.size > 1 || stocked.length > 1) {
      for (const m of members) {
        actions.push({
          ...base(m, canonical),
          kind: 'review',
          reason:
            vintages.size > 1
              ? `${members.length} items share ${canonical} but their names give different vintages (${[...vintages].join(', ')})`
              : `${stocked.length} items under ${canonical} all hold Zoho stock — merge the stock in Zoho first`,
          blocked: null,
        });
      }
      continue;
    }

    const isDashed = (m: CleanupItem) => m.sku.trim().toUpperCase() === canonical;
    const keep =
      stocked[0] ??
      members.find(isDashed) ??
      [...members].sort((a, b) => b.createdTime.localeCompare(a.createdTime))[0]!;
    const holder = members.find((m) => m !== keep && isDashed(m));

    for (const m of members) {
      if (m === keep) continue;
      actions.push({
        ...base(m, canonical),
        kind: 'retire_duplicate',
        toSku: isDashed(m) ? `${canonical}-OLD` : null,
        keepItemId: keep.itemId,
        reason: `Duplicate of "${keep.name}" (${keep.sku})`,
        blocked: retireBlock(m),
      });
    }
    if (!isDashed(keep)) {
      actions.push({
        ...base(keep, canonical),
        kind: 'add_dashes',
        toSku: canonical,
        dependsOn: holder?.itemId ?? null,
        reason: holder
          ? `Kept item; takes ${canonical} once the duplicate is retired`
          : `Kept item; Stock Explorer form ${canonical}`,
        blocked: null,
      });
    }
  }

  // A kept item waits on a duplicate that cannot be retired
  const blockedIds = new Set(actions.filter((a) => a.blocked).map((a) => a.itemId));
  for (const a of actions) {
    if (a.dependsOn && blockedIds.has(a.dependsOn)) a.blocked = 'Waits on its duplicate, which cannot be retired yet';
  }

  return actions;
};

export default planSkuCleanup;
