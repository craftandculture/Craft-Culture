import { asc, eq } from 'drizzle-orm';

import { lwinPakKeyOf } from '@/app/_wms/utils/lwinPakKey';
import normalizeLwin18 from '@/app/_wms/utils/normalizeLwin18';
import db from '@/database/client';
import {
  partners,
  privateClientOrderItems,
  privateClientOrders,
} from '@/database/schema';

import resolveTradePrices from './resolveTradePrices';

/**
 * What sits in `zohoSalesOrderId` while an order is being raised
 *
 * Not a Zoho id. The create claims the column before it calls Zoho so that a
 * second press finds the order taken, and swaps in the real id afterwards.
 */
export const CLAIM = 'pending';

/**
 * How long a claim can stand before it is assumed abandoned
 *
 * The claim is released on any failure, but a process that dies between taking
 * it and releasing it would otherwise lock the order out of ever raising a
 * sales order, with nothing in the UI able to clear it. Comfortably longer than
 * the Zoho round trip, which is a few seconds even for a long order.
 */
export const CLAIM_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Statuses from which the sales order may be raised
 *
 * From C&C approval onwards, which is well before anyone has been paid. The
 * invoice this order produces is a movement document: it is what lets the wine
 * leave the free zone for the distributor on the mainland, and the client pays
 * against it afterwards. Gating on payment would be gating the paperwork on the
 * event the paperwork exists to cause.
 */
const RAISEABLE = new Set([
  'cc_approved',
  'awaiting_partner_verification',
  'awaiting_distributor_verification',
  'verification_suspended',
  'awaiting_client_payment',
  'awaiting_payment_verification',
  'client_paid',
  'awaiting_distributor_payment',
  'distributor_paid',
  'awaiting_partner_payment',
  'partner_paid',
  'scheduling_delivery',
  'delivery_scheduled',
  'stock_in_transit',
  'with_distributor',
  'out_for_delivery',
  'delivered',
]);

export interface PlannedLine {
  orderItemId: string;
  wine: string;
  producer: string | null;
  vintage: number | null;
  /** The LWIN18 of the pack being SOLD, not of the stock it comes out of */
  saleLwin18: string;
  /** The Zoho item name, which carries the pack because Zoho makes names unique */
  packName: string;
  /** Bottles in the pack being sold */
  pack: number;
  bottleSizeMl: number;
  cases: number;
  bottles: number;
  /** Trade price per bottle, or null where we cannot price it */
  tradePerBottle: number | null;
  tradeSource: 'stock' | 'inbound' | null;
  /** What the line will be billed at per case */
  ratePerCase: number;
  /** What the PCO itself has for this line, for comparison */
  pcoPricePerCase: number;
}

/**
 * Work out the sales order a private client order would raise
 *
 * Read-only and deliberately separate from the act of raising it, so the
 * confirmation someone is shown is built by the same code that then runs. A
 * preview assembled independently is a preview that can disagree with what
 * happens, which is worse than no preview at all.
 *
 * @example
 *   const plan = await planZohoSalesOrder('uuid');
 *   plan.lines.filter((line) => line.tradePerBottle === null);
 *
 * @param orderId - The private client order
 * @returns The customer, the lines, and anything that blocks or needs saying
 */
const planZohoSalesOrder = async (orderId: string) => {
  const [order] = await db
    .select()
    .from(privateClientOrders)
    .where(eq(privateClientOrders.id, orderId));

  if (!order) return null;

  const items = await db
    .select()
    .from(privateClientOrderItems)
    .where(eq(privateClientOrderItems.orderId, orderId))
    .orderBy(asc(privateClientOrderItems.createdAt));

  const [distributor] = order.distributorId
    ? await db
        .select()
        .from(partners)
        .where(eq(partners.id, order.distributorId))
    : [];

  const prices = await resolveTradePrices();

  const blockers: string[] = [];

  if (!RAISEABLE.has(order.status)) {
    blockers.push(
      `This order is ${order.status.replace(/_/g, ' ')}. A sales order can be raised once C&C has approved it.`,
    );
  }

  /*
    `pending` is the claim the create takes before it calls Zoho, not a real
    sales order — it is how a double press cannot raise two. It clears itself
    either way, so what it means here is "someone is raising one right now".
  */
  if (order.zohoSalesOrderId === CLAIM) {
    blockers.push(
      'A sales order is being raised from this order right now. Give it a moment.',
    );
  } else if (order.zohoSalesOrderId) {
    blockers.push(
      `Sales order ${order.zohoSalesOrderNumber ?? order.zohoSalesOrderId} has already been raised from this order.`,
    );
  }

  if (!order.distributorId) {
    blockers.push(
      'No distributor is assigned. The sales order is billed to the distributor, so there is nobody to raise it against.',
    );
  } else if (!distributor) {
    blockers.push('The assigned distributor no longer exists.');
  } else if (!distributor.zohoContactId) {
    blockers.push(
      `${distributor.businessName} has no Zoho customer linked. Link it on the partner record — creating one from here is how a duplicate customer gets into the accounts.`,
    );
  }

  if (items.length === 0) blockers.push('This order has no lines.');

  const lines: PlannedLine[] = [];
  const unpriced: string[] = [];
  const noLwin: string[] = [];

  for (const item of items) {
    const label = `${item.productName}${item.vintage ? ` ${item.vintage}` : ''}`;

    /*
      Without a LWIN there is no SKU, and a Zoho item created without one is a
      code nothing downstream can match — not stock, not pricing, not the next
      order for the same wine. Better to say so than to mint a stray.
    */
    if (!item.lwin) {
      noLwin.push(label);
      continue;
    }

    const held = normalizeLwin18(item.lwin);
    const parts = held.split('-');
    const pack = item.caseConfig && item.caseConfig > 0 ? item.caseConfig : 12;

    /*
      The pack sold, not the pack held. A client taking two bottles out of a six
      is a different Zoho item from the six — booking it against the case code
      bills two bottles at a case rate and depletes the wrong thing.
    */
    const saleLwin18 =
      parts.length === 4
        ? [
            parts[0],
            parts[1],
            String(pack).padStart(2, '0'),
            parts[3],
          ].join('-')
        : held;

    const sizeFromLwin = Number(parts[3]);
    const bottleSizeMl =
      Number.isFinite(sizeFromLwin) && sizeFromLwin > 0 ? sizeFromLwin : 750;

    const price = prices.get(lwinPakKeyOf(saleLwin18)) ?? null;

    if (!price) unpriced.push(label);

    const vintage = item.vintage ? Number(item.vintage) : null;
    const sizeCl = Math.round(bottleSizeMl / 10);
    const named = vintage && item.productName.includes(String(vintage));
    const packName = `${item.productName}${named || !vintage ? '' : ` ${vintage}`} (${pack}x${sizeCl}cl)`;

    lines.push({
      orderItemId: item.id,
      wine: item.productName,
      producer: item.producer,
      vintage: Number.isFinite(vintage) ? vintage : null,
      saleLwin18,
      packName,
      pack,
      bottleSizeMl,
      cases: item.quantity,
      bottles: item.quantity * pack,
      tradePerBottle: price?.perBottle ?? null,
      tradeSource: price?.source ?? null,
      ratePerCase: price ? Math.round(price.perBottle * pack * 100) / 100 : 0,
      pcoPricePerCase: item.pricePerCaseUsd,
    });
  }

  if (noLwin.length > 0) {
    blockers.push(
      `No LWIN on ${noLwin.length} line${noLwin.length === 1 ? '' : 's'}: ${noLwin.join('; ')}. Set the wine on the line first.`,
    );
  }

  return {
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      clientName: order.clientName,
      zohoSalesOrderId: order.zohoSalesOrderId,
      zohoSalesOrderNumber: order.zohoSalesOrderNumber,
    },
    customer: distributor?.zohoContactId
      ? { contactId: distributor.zohoContactId, name: distributor.businessName }
      : null,
    lines,
    blockers,
    /** Lines we could not price, which are created at zero and must be filled in */
    unpriced,
    tradeTotal: lines.reduce(
      (sum, line) => sum + line.ratePerCase * line.cases,
      0,
    ),
    pcoTotal: lines.reduce(
      (sum, line) => sum + line.pcoPricePerCase * line.cases,
      0,
    ),
  };
};

export default planZohoSalesOrder;
