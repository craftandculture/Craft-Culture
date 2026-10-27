import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { cellarReleaseRequestItems, cellarUkMoveItems } from '@/database/schema';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

import buildEmailWines, { type EmailWineLine } from './buildEmailWines';
import queueMemberEmail from './queueMemberEmail';
import { DELIVERY_STAGES } from '../utils/deliveryStage';

/*
  The words of each member email, and the event that queues it. Written to the
  approved copy rules: professional, collector-led, wine first; no prices or
  fees, no contractions, no exclamation marks, and no dash as a sentence break
  (see ~/Downloads/private-cellar-emails/test-templates.mjs).
*/

/**
 * Never let an email stop the work that triggered it: a failed wine lookup is
 * logged and the email skipped, and the delivery, move or receipt stands.
 */
const safely =
  <T,>(name: string, queue: (params: T) => Promise<number>) =>
  async (params: T) => {
    try {
      return await queue(params);
    } catch (error) {
      logger.error('Failed to queue a member email', {
        email: name,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  };

const cellarUrl = () => `${serverConfig.appUrl}/platform/cellar`;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** A bottle count as a collector says it, by bottle size */
const describeBottles = (bottles: number, size?: string | number | null) => {
  const litres = typeof size === 'number' ? size : Number.parseFloat(String(size ?? '').replace(/[^\d.]/g, ''));
  // Sizes are stored as litres (1.5) or millilitres (1500); 75cl is the default
  const ml = Number.isFinite(litres) ? (litres < 20 ? litres * 1000 : litres) : 750;
  if (ml >= 1400 && ml <= 1600) return plural(bottles, 'magnum');
  if (ml >= 350 && ml <= 400) return plural(bottles, 'half bottle');
  return plural(bottles, 'bottle');
};

/** The wines on a delivery request, ready for the email */
const releaseWines = async (requestId: string) => {
  const lines = await db
    .select({
      productName: cellarReleaseRequestItems.productName,
      vintage: cellarReleaseRequestItems.vintage,
      lwin18: cellarReleaseRequestItems.lwin18,
      bottles: cellarReleaseRequestItems.bottles,
      bottleSize: cellarReleaseRequestItems.bottleSize,
    })
    .from(cellarReleaseRequestItems)
    .where(eq(cellarReleaseRequestItems.requestId, requestId));

  const wines = await buildEmailWines(
    lines.map(
      (line): EmailWineLine => ({
        name: line.productName,
        vintage: line.vintage,
        lwin18: line.lwin18,
        quantity: describeBottles(line.bottles, line.bottleSize),
      }),
    ),
  );

  return { wines, _bottles: lines.reduce((sum, line) => sum + line.bottles, 0) };
};

interface ReleaseRef {
  partnerId: string;
  requestId: string;
  requestNumber: string;
}

/** Staff have prepared a delivery; the member is asked to confirm it */
export const queueDeliveryQuoted = safely('queueDeliveryQuoted', async ({ partnerId, requestId, requestNumber }: ReleaseRef) =>
  queueMemberEmail({
    kind: 'deliveryQuoted',
    partnerId,
    entityId: requestId,
    data: {
      subject: 'Your delivery is ready to confirm',
      preheader: 'Please review the wines and confirm your delivery.',
      eyebrow: 'Delivery',
      headline: 'Your delivery is ready to confirm',
      body: 'Your delivery has been prepared. Please review the wines below and confirm. Your wine will then be transferred to City Drinks, our delivery partner, who will contact you to arrange a convenient time.',
      ...(await releaseWines(requestId)),
      ctaLabel: 'Review and confirm',
      ctaUrl: cellarUrl(),
      note: 'No wine will leave your cellar until you have confirmed.',
      reference: `Delivery ${requestNumber}`,
    },
  }));

/** Staff have sent a delivery request back for a change */
export const queueDeliverySentBack = safely('queueDeliverySentBack', async ({
  partnerId,
  requestId,
  requestNumber,
  adminNotes,
}: ReleaseRef & { adminNotes?: string | null }) =>
  queueMemberEmail({
    kind: 'deliverySentBack',
    partnerId,
    // A request can be sent back more than once; each time is its own email
    entityId: `${requestId}:${Date.now()}`,
    data: {
      subject: 'Your delivery request requires amendment',
      preheader: 'Our team has asked for a change before your delivery can be prepared.',
      eyebrow: 'Delivery',
      headline: 'Your delivery request requires amendment',
      body: `Our team has reviewed your delivery request and asked for a change before it can be prepared. ${adminNotes?.trim() ?? ''}`.trim(),
      ctaLabel: 'Review your request',
      ctaUrl: cellarUrl(),
      note: 'Your wine remains in your cellar until the request is confirmed.',
      reference: `Delivery ${requestNumber}`,
    },
  }));

/** Staff have declined a delivery request */
export const queueDeliveryCancelled = safely('queueDeliveryCancelled', async ({
  partnerId,
  requestId,
  requestNumber,
  adminNotes,
}: ReleaseRef & { adminNotes?: string | null }) =>
  queueMemberEmail({
    kind: 'deliveryCancelled',
    partnerId,
    entityId: requestId,
    data: {
      subject: 'Your delivery request has been cancelled',
      preheader: 'Your wine remains in your cellar.',
      eyebrow: 'Delivery',
      headline: 'Your delivery request has been cancelled',
      body: `Your delivery request has been cancelled and your wine remains in your cellar. ${adminNotes?.trim() ?? ''}`.trim(),
      ctaLabel: 'View your cellar',
      ctaUrl: cellarUrl(),
      note: 'Should you wish to arrange a new delivery, you may do so from your cellar at any time.',
      reference: `Delivery ${requestNumber}`,
    },
  }));

/**
 * A delivery has left the bonded warehouse with City Drinks
 *
 * The one email a delivery sends after it is confirmed; every other stage is
 * in-app only, and City Drinks contacts the member for the final delivery.
 * The progress list is the portal's own six stages, so the email and the
 * delivery tracker always agree.
 */
export const queueDeliveryCollected = safely('queueDeliveryCollected', async ({ partnerId, requestId, requestNumber, stage }: ReleaseRef & { stage: number }) =>
  queueMemberEmail({
    kind: 'deliveryCollected',
    partnerId,
    entityId: requestId,
    data: {
      subject: 'Your wine has left our bonded warehouse',
      preheader: 'Your wine is on its way to City Drinks, who will contact you to arrange delivery.',
      eyebrow: 'Delivery',
      headline: 'Your wine is on its way to City Drinks',
      body: 'Your wine has been picked, packed and released from the C&C bonded warehouse. It is now being transferred to City Drinks, our delivery partner on the mainland.',
      steps: DELIVERY_STAGES.map((content, index) => ({
        mark: index <= stage ? '✓' : index === stage + 1 ? '→' : '○',
        label: content.label,
        when: index === stage + 1 ? 'Next' : '',
      })),
      ...(await releaseWines(requestId)),
      ctaLabel: 'Follow your delivery',
      ctaUrl: cellarUrl(),
      note: 'City Drinks will contact you directly to agree a convenient delivery time. Please ensure they can reach you on the mobile number held on your account.',
      reference: `Delivery ${requestNumber}`,
    },
  }));

/** Wine has been received into a member's UAE cellar */
export const queueWineArrived = safely('queueWineArrived', async ({
  partnerId,
  entityId,
  productName,
  lwin18,
  bottles,
  shipmentNumber,
}: {
  partnerId: string;
  entityId: string;
  productName: string;
  lwin18?: string | null;
  bottles: number;
  shipmentNumber?: string | null;
}) =>
  queueMemberEmail({
    kind: 'wineArrived',
    partnerId,
    entityId,
    data: {
      subject: 'Your wine has arrived',
      preheader: 'Your wine has been inspected and placed in your cellar.',
      eyebrow: 'New arrival',
      headline: 'Your wine is in your cellar',
      body: 'Your wine has arrived at the C&C Warehouse. Each bottle has been inspected, labelled and placed in your cellar.',
      wines: await buildEmailWines([{ name: productName, lwin18, quantity: plural(bottles, 'bottle') }]),
      _bottles: bottles,
      ctaLabel: 'View your cellar',
      ctaUrl: cellarUrl(),
      note: 'Each wine is now listed in your cellar, where you may view it at any time.',
      reference: shipmentNumber ? `Shipment ${shipmentNumber}` : '',
    },
  }));

/** The wines on a UK to UAE move, ready for the email */
const ukMoveWines = async (moveId: string) => {
  const lines = await db
    .select({
      name: cellarUkMoveItems.name,
      vintage: cellarUkMoveItems.vintage,
      lwin18: cellarUkMoveItems.lwin18,
      totalBottles: cellarUkMoveItems.totalBottles,
      bottleSizeLitres: cellarUkMoveItems.bottleSizeLitres,
    })
    .from(cellarUkMoveItems)
    .where(eq(cellarUkMoveItems.moveId, moveId));

  const wines = await buildEmailWines(
    lines.map(
      (line): EmailWineLine => ({
        name: line.name,
        vintage: line.vintage,
        lwin18: line.lwin18,
        quantity: describeBottles(line.totalBottles, line.bottleSizeLitres),
      }),
    ),
  );

  return { wines, _bottles: lines.reduce((sum, line) => sum + line.totalBottles, 0) };
};

interface UkMoveRef {
  partnerId: string;
  moveId: string;
  moveNumber: string;
}

/** Staff have prepared a move from the UK; the member is asked to confirm it */
export const queueUkMoveQuoted = safely('queueUkMoveQuoted', async ({ partnerId, moveId, moveNumber }: UkMoveRef) =>
  queueMemberEmail({
    kind: 'ukMoveQuoted',
    partnerId,
    entityId: moveId,
    data: {
      subject: 'Your move to the UAE is ready to confirm',
      preheader: 'Please review the wines and confirm your move from the United Kingdom.',
      eyebrow: 'Transfer from the UK',
      headline: 'Your move to the UAE is ready to confirm',
      body: 'Your move from our bonded warehouse in the United Kingdom has been prepared. Please review the wines below and confirm, and we will arrange their shipment to your cellar in the UAE.',
      ...(await ukMoveWines(moveId)),
      ctaLabel: 'Review and confirm',
      ctaUrl: cellarUrl(),
      note: 'No wine will leave the United Kingdom until you have confirmed.',
      reference: `Move ${moveNumber}`,
    },
  }));

/** Staff have closed a move from the UK */
export const queueUkMoveSentBack = safely('queueUkMoveSentBack', async ({ partnerId, moveId, moveNumber, adminNotes }: UkMoveRef & { adminNotes?: string | null }) =>
  queueMemberEmail({
    kind: 'ukMoveSentBack',
    partnerId,
    entityId: moveId,
    data: {
      subject: 'An update on your move to the UAE',
      preheader: 'Your wine remains in our bonded warehouse in the United Kingdom.',
      eyebrow: 'Transfer from the UK',
      headline: 'An update on your move to the UAE',
      body: `Your move from the United Kingdom has been closed and your wine remains in our bonded warehouse there. ${adminNotes?.trim() ?? ''}`.trim(),
      ctaLabel: 'View your cellar',
      ctaUrl: cellarUrl(),
      note: 'Should you wish to arrange a new move, you may do so from your cellar at any time.',
      reference: `Move ${moveNumber}`,
    },
  }));

/** A move from the UK has been shipped */
export const queueUkMoveShipped = safely('queueUkMoveShipped', async ({ partnerId, moveId, moveNumber }: UkMoveRef) =>
  queueMemberEmail({
    kind: 'ukMoveShipped',
    partnerId,
    entityId: moveId,
    data: {
      subject: 'Your wine is on its way to the UAE',
      preheader: 'Your wine has left our UK bonded warehouse and is in transit to your cellar.',
      eyebrow: 'Transfer from the UK',
      headline: 'Your wine is on its way to the UAE',
      body: 'Your wine has left our bonded warehouse in the United Kingdom and is now in transit to your cellar in the UAE. We will write to you again once it has arrived and been checked in.',
      ctaLabel: 'Follow the move',
      ctaUrl: cellarUrl(),
      note: 'You may follow the progress of this move in your cellar at any time.',
      reference: `Move ${moveNumber}`,
    },
  }));
