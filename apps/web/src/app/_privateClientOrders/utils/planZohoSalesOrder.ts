import { asc, eq } from 'drizzle-orm';

import isUsableLwin18 from '@/app/_lwin/utils/isUsableLwin18';
import { lwinPakKeyOf } from '@/app/_wms/utils/lwinPakKey';
import normalizeLwin18 from '@/app/_wms/utils/normalizeLwin18';
import db from '@/database/client';
import {
  partners,
  privateClientOrderItems,
  privateClientOrders,
} from '@/database/schema';

import resolveTradePrices from './resolveTradePrices';
import saleLwin18Of from './saleLwin18Of';

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
  /** What the line will be billed at per case — the price it was agreed at */
  ratePerCase: number;
  /** What the cost model would charge per case, for comparison only */
  tradeRatePerCase: number | null;
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
  let needsZohoContact: {
    partnerId: string;
    partnerName: string;
  } | null = null;

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
      `${distributor.businessName} has no Zoho customer linked. Pick the customer it is billed as — creating one from here is how a duplicate gets into the accounts.`,
    );

    /*
      Named separately from the prose so the screen can offer to fix it rather
      than only explain it. This is the one blocker that is a missing link
      rather than a mistake, and it is answerable on the spot.
    */
    needsZohoContact = {
      partnerId: distributor.id,
      partnerName: distributor.businessName,
    };
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

      A placeholder is the same as none. Partner lines picked from the local
      inventory sheet carried its row keys ("1010000000000000000:row28"), and
      SO-00146 created six Zoho items under them before this checked the shape.
    */
    if (!item.lwin || !isUsableLwin18(item.lwin)) {
      noLwin.push(label);
      continue;
    }

    const parts = normalizeLwin18(item.lwin).split('-');
    const pack = item.caseConfig && item.caseConfig > 0 ? item.caseConfig : 12;

    /* The pack sold, not the pack held */
    const saleLwin18 = saleLwin18Of(item.lwin, item.caseConfig);

    const sizeFromLwin = Number(parts[3]);
    const bottleSizeMl =
      Number.isFinite(sizeFromLwin) && sizeFromLwin > 0 ? sizeFromLwin : 750;

    /*
      The catalogue's trade price is a CHECK here, not the price.

      The order is billed at the price the line was agreed at; this is only
      what the cost model would have charged, so a line struck below trade can
      be pointed out before it is invoiced.
    */
    const trade = prices.get(lwinPakKeyOf(saleLwin18)) ?? null;

    /*
      A line with no price is the one that must not go quietly. Everything else
      has a number somebody agreed; this would reach a customs document as a
      zero, so it is named on the confirmation and on the order itself.
    */
    if (!item.pricePerCaseUsd || item.pricePerCaseUsd <= 0) unpriced.push(label);

    const vintage = item.vintage ? Number(item.vintage) : null;
    const sizeCl = Math.round(bottleSizeMl / 10);

    /*
      A pack already written into the stored name is dropped before ours is
      added. These names carry the pack they were RECEIVED in — "Bruno Clair
      Vosne-Romanee Aux Champs Perdrix (3x)" — and appending the pack being
      SOLD produced "... (3x) 2023 (2x75cl)", which names two different packs
      in one breath and is read by whoever picks it in Zoho.
    */
    const bareName = item.productName.replace(/\s*\(\d+\s*x\)\s*/gi, ' ').trim();
    const named = vintage && bareName.includes(String(vintage));
    const packName = `${bareName}${named || !vintage ? '' : ` ${vintage}`} (${pack}x${sizeCl}cl)`;

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
      tradePerBottle: trade?.perBottle ?? null,
      tradeSource: trade?.source ?? null,
      /*
        The price this line was agreed at. The distributor is invoiced what was
        struck with them, not what the cost model would compute today — a
        catalogue that moves between the order and the invoice must not quietly
        change the amount somebody is billed.
      */
      ratePerCase: item.pricePerCaseUsd,
      tradeRatePerCase: trade
        ? Math.round(trade.perBottle * pack * 100) / 100
        : null,
      pcoPricePerCase: item.pricePerCaseUsd,
    });
  }

  /*
    Lines struck below what the cost model says they are worth.

    Not a blocker — a price agreed is a price agreed, and there are good reasons
    to go under. But it is worth one look before it becomes an invoice, because
    the usual cause is a stale figure rather than a decision.
  */
  const belowTrade = lines
    .filter(
      (line) =>
        line.tradeRatePerCase !== null &&
        line.ratePerCase > 0 &&
        line.ratePerCase < line.tradeRatePerCase,
    )
    .map(
      (line) =>
        `${line.wine} — ${line.ratePerCase.toFixed(2)} vs ${line.tradeRatePerCase?.toFixed(2)} trade`,
    );

  if (noLwin.length > 0) {
    blockers.push(
      `No LWIN on ${noLwin.length} line${noLwin.length === 1 ? '' : 's'}: ${noLwin.join('; ')}. Set the LWIN on each line (the edit button) first.`,
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
      /*
        What the end client actually pays: the PCO's own grand total, with the
        distributor's margin and VAT on top of the line prices. Distinct from
        the sum of the lines, which is a private-client figure and was labelled
        as the client's for a day.
      */
      clientTotalUsd: order.totalUsd,
    },
    customer: distributor?.zohoContactId
      ? { contactId: distributor.zohoContactId, name: distributor.businessName }
      : null,
    lines,
    blockers,
    /** Set when the only thing missing is the distributor's Zoho customer */
    needsZohoContact,
    /** Lines we could not price, which are created at zero and must be filled in */
    unpriced,
    /** What the sales order bills — the agreed line prices */
    orderTotal: lines.reduce(
      (sum, line) => sum + line.ratePerCase * line.cases,
      0,
    ),
    /** What the cost model would have charged, where it knows the wine */
    tradeTotal: lines.reduce(
      (sum, line) => sum + (line.tradeRatePerCase ?? line.ratePerCase) * line.cases,
      0,
    ),
    belowTrade,
    /*
      The PCO's line prices summed — a PRIVATE CLIENT figure, not what anybody
      is billed here. Kept for comparison against trade, since the gap between
      them is the whole reason the two totals are shown together.
    */
    pcoLinesTotal: lines.reduce(
      (sum, line) => sum + line.pcoPricePerCase * line.cases,
      0,
    ),
  };
};

export default planZohoSalesOrder;
