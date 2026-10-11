import { lwinPakKeyOf } from '@/app/_wms/utils/lwinPakKey';

import parseZohoSku from './parseZohoSku';

export interface CleanupItem {
  itemId: string;
  name: string;
  sku: string;
  status: 'active' | 'inactive';
  productType: string | null;
  createdTime: string;
}

export interface StockExplorerLine {
  lwin18: string;
  productName: string;
  producer: string | null;
  vintage: number | null;
}

export interface CleanupContext {
  /** Stock Explorer lines with stock, one per exact dashed LWIN-18 */
  stockExplorer: Map<string, StockExplorerLine>;
  /** Wine-vintage-size keys held on hand or inbound, any pack */
  heldKeys: Set<string>;
  /** Zoho item ids on an undispatched sales order or a draft SO/invoice */
  openItemIds: Set<string>;
  /** Zoho item ids sold in the last 90 days */
  recentlySoldItemIds: Set<string>;
  /** Items created this recently are left alone (ISO date) */
  newSince: string;
}

export type CleanupKind = 'retire' | 'retire_duplicate' | 'retire_not_held' | 'create' | 'review';

export interface CleanupAction {
  /** Zoho item id, or `new:<lwin18>` for an item to be created */
  id: string;
  itemId: string | null;
  name: string;
  sku: string;
  kind: CleanupKind;
  /** Name a retired item is given, so the new item can take the old one */
  toName: string | null;
  /** A retired item's dashed SKU gets "-OLD", so no lookup finds it again */
  toSku: string | null;
  canonical: string | null;
  reason: string;
  /** Why it cannot run yet; null when it can */
  blocked: string | null;
  stockExplorerName: string | null;
  /** For 'create': what the new item is built from */
  create: (StockExplorerLine & { bottlesPerCase: number; bottleSizeMl: number }) | null;
  /** A retirement that must run first: it frees the name this item takes */
  dependsOn: string | null;
}

const SERVICE = /^(storage|repack|transport|monthly|brand development)/i;
const NAME_MAX = 100;

const yearsIn = (name: string) => [...name.matchAll(/\b(19[5-9]\d|20[0-3]\d)\b/g)].map((m) => m[1]!);

/**
 * The Zoho item name for a Stock Explorer line
 *
 * Pack and size are part of the name because Zoho refuses two items with one
 * name, and the 6-pack and 3-pack of a wine are two items. The producer leads
 * when Stock Explorer's name leaves it out, as it does for spirits.
 *
 * @example
 *   itemNameFor({ productName: 'Chateau Talbot', vintage: 2020 }, 6, 750); // 'Chateau Talbot 2020 (6x75cl)'
 */
export const itemNameFor = (
  line: Pick<StockExplorerLine, 'productName' | 'vintage'> & { producer?: string | null },
  bottlesPerCase: number,
  bottleSizeMl: number,
) => {
  // "Mezcal - Blanco" means nothing to a picker; "Bandida, Mezcal - Blanco" does
  const producer = line.producer?.trim();
  const named = producer && !line.productName.toLowerCase().includes(producer.toLowerCase()) ? `${producer}, ${line.productName}` : line.productName;
  const base = line.vintage && !named.includes(String(line.vintage)) ? `${named} ${line.vintage}` : named;
  return `${base} (${bottlesPerCase}x${Math.round(bottleSizeMl / 10)}cl)`;
};

/**
 * Plan the clean start: one active Zoho item per Stock Explorer code
 *
 * Zoho's own stock count is not used — Stock Explorer is the stock record.
 * - Every item whose SKU is not a dashed LWIN-18 (compact codes, brand codes,
 *   blanks) is retired: renamed "… (old)" and made inactive. A retired item
 *   with a dashed SKU also has "-OLD" added, so no order or receipt can find
 *   it again. Service lines are left alone.
 * - Two active items under one dashed code: the one on an open document (else
 *   the newest) is kept and the rest retired.
 * - Every Stock Explorer line with no active dashed item is created from the
 *   Stock Explorer record, after the retirements free its name.
 * - A dashed code Stock Explorer does not hold in any pack, nor inbound, is
 *   offered for retirement separately.
 * - A dashed item whose name gives a different vintage from its code goes to
 *   review: its code may be wrong.
 *
 * Nothing on an undispatched sales order or a draft is retired, nor an item
 * sold in the last 90 days that nothing in Stock Explorer would replace.
 *
 * @param items - Every Zoho item, active and inactive
 * @param ctx - Stock Explorer, inbound and open-document evidence
 * @returns The actions, retirements before creations
 */
const planSkuCleanup = (items: CleanupItem[], ctx: CleanupContext) => {
  const actions: CleanupAction[] = [];
  const active = items.filter((i) => i.status === 'active');
  const names = new Set(items.map((i) => i.name.trim().toLowerCase()));

  const retireName = (i: CleanupItem) => {
    const base = i.name.slice(0, NAME_MAX - 12);
    let name = `${base} (old)`;
    if (names.has(name.toLowerCase())) name = `${base} (old ${i.itemId.slice(-5)})`;
    names.add(name.toLowerCase());
    // The old name is free for the item that replaces it
    names.delete(i.name.trim().toLowerCase());
    return name;
  };
  const blockOf = (i: CleanupItem) => (ctx.openItemIds.has(i.itemId) ? 'On an open sales order or draft — retire once it has gone through' : null);
  const seName = (canonical: string | null) => (canonical ? (ctx.stockExplorer.get(canonical)?.productName ?? null) : null);

  const retire = (i: CleanupItem, kind: CleanupKind, canonical: string | null, reason: string) => {
    const blocked = blockOf(i);
    actions.push({
      id: i.itemId,
      itemId: i.itemId,
      name: i.name,
      sku: i.sku,
      kind,
      toName: blocked ? null : retireName(i),
      toSku: !blocked && parseZohoSku(i.sku).form === 'dashed' ? `${i.sku.trim()}-OLD` : null,
      canonical,
      reason,
      blocked,
      stockExplorerName: seName(canonical),
      create: null,
      dependsOn: null,
    });
    return !blocked;
  };

  // Spirits and other non-LWIN lines are matched to Stock Explorer by name:
  // "Bandida Mezcal - Black" is replaced by Stock Explorer's "Mezcal - Black"
  const flat = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
  const byName = [...ctx.stockExplorer.values()]
    .filter((l) => !/^\d{7}-/.test(l.lwin18) && flat(l.productName).length >= 8)
    .map((l) => ({ line: l, key: flat(l.productName) }));
  const replacementFor = (i: CleanupItem, canonical: string | null) => {
    if (canonical) return ctx.stockExplorer.get(canonical) ?? null;
    const name = flat(i.name);
    return byName.find((b) => name.includes(b.key))?.line ?? null;
  };

  // Codes that will still have an active dashed item afterwards
  const covered = new Set<string>();
  const dashed = new Map<string, CleanupItem[]>();

  for (const i of active) {
    if (i.productType === 'service' || SERVICE.test(i.name) || SERVICE.test(i.sku)) continue;
    const { canonical, form } = parseZohoSku(i.sku);
    if (form !== 'dashed' || !canonical) {
      const why =
        form === 'blank' ? 'No SKU' : canonical ? `Old code format (${canonical} in Stock Explorer form)` : `"${i.sku}" is not an LWIN`;
      const replacement = replacementFor(i, canonical);
      if (!replacement && ctx.recentlySoldItemIds.has(i.itemId)) {
        actions.push({
          id: i.itemId,
          itemId: i.itemId,
          name: i.name,
          sku: i.sku,
          kind: 'retire',
          toName: null,
          toSku: null,
          canonical,
          reason: why,
          blocked: 'Sold in the last 90 days and not in Stock Explorer, so nothing would replace it — kept until it is received under a Stock Explorer code',
          stockExplorerName: null,
          create: null,
          dependsOn: null,
        });
        continue;
      }
      retire(i, 'retire', canonical, replacement ? `${why}; replaced by ${replacement.lwin18}` : `${why}; not held, not sold in 90 days`);
      continue;
    }
    dashed.set(canonical, [...(dashed.get(canonical) ?? []), i]);
  }

  for (const [canonical, members] of dashed) {
    const keep =
      members.find((m) => ctx.openItemIds.has(m.itemId)) ??
      [...members].sort((a, b) => b.createdTime.localeCompare(a.createdTime))[0]!;
    covered.add(canonical);

    for (const m of members) {
      if (m !== keep) retire(m, 'retire_duplicate', canonical, `Duplicate of "${keep.name}"`);
    }

    const vintage = canonical.split('-')[1]!;
    const years = yearsIn(keep.name);
    if (years.length && !['1000', '0000'].includes(vintage) && !years.includes(vintage)) {
      actions.push({
        id: keep.itemId,
        itemId: keep.itemId,
        name: keep.name,
        sku: keep.sku,
        kind: 'review',
        toName: null,
        toSku: null,
        canonical,
        reason: `Code says ${vintage}, name says ${years.join('/')} — one of them is wrong`,
        blocked: null,
        stockExplorerName: seName(canonical),
        create: null,
        dependsOn: null,
      });
      continue;
    }

    if (!ctx.heldKeys.has(lwinPakKeyOf(canonical)) && keep.createdTime < ctx.newSince) {
      if (retire(keep, 'retire_not_held', canonical, 'Not in Stock Explorer or inbound in any pack')) covered.delete(canonical);
    }
  }

  const freedBy = new Map(actions.filter((a) => a.toName).map((a) => [a.name.trim().toLowerCase(), a.id]));

  for (const [lwin18, line] of ctx.stockExplorer) {
    if (covered.has(lwin18)) continue;
    const [, , pack, size] = lwin18.split('-');
    const bottlesPerCase = Number(pack) || 1;
    const bottleSizeMl = Number(size) || 750;
    let name = itemNameFor(line, bottlesPerCase, bottleSizeMl);
    if (names.has(name.toLowerCase())) name = `${name} ${lwin18}`;
    names.add(name.toLowerCase());
    actions.push({
      id: `new:${lwin18}`,
      itemId: null,
      name,
      sku: lwin18,
      kind: 'create',
      toName: null,
      toSku: null,
      canonical: lwin18,
      reason: 'In Stock Explorer with no active Zoho item under its code',
      blocked: null,
      stockExplorerName: line.productName,
      create: { ...line, bottlesPerCase, bottleSizeMl },
      dependsOn: freedBy.get(name.toLowerCase()) ?? null,
    });
  }

  return actions;
};

export default planSkuCleanup;
