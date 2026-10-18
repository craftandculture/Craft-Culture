import { and, asc, eq, inArray, isNull, lt, notInArray, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  cellarApplications,
  cellarIntakes,
  cellarMemberships,
  cellarPurchases,
  cellarReleaseRequests,
  cellarUkHoldings,
  cellarUkRotations,
  partners,
  privateClientOrders,
  saleMandates,
  teamTasks,
} from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

const DAY = 24 * 60 * 60 * 1000;

/** Rows shown under each heading before the queue sends you to its screen */
const SHOWN = 5;

interface AttentionRow {
  id: string;
  title: string;
  detail: string;
  since: Date | null;
}

interface AttentionGroup {
  key: string;
  label: string;
  /** What to do about it, in one line */
  action: string;
  tone: 'urgent' | 'action' | 'chase';
  href: string;
  count: number;
  rows: AttentionRow[];
}

/*
  Each group is read on its own and a failure empties only that group. Several
  of these tables are new, and migrate.mjs can quietly not run: one missing
  table must not blank the whole queue.
*/
const safely = async (key: string, read: () => Promise<AttentionRow[]>) => {
  try {
    return await read();
  } catch (error) {
    logger.error('Cellar attention group could not be read', { error, key });
    return [];
  }
};

/**
 * Everything in Private Cellar that is waiting on the team
 *
 * One list across purchases, deliveries, offers, sign-ups, transfers and the
 * UK bond, so nobody has to open six screens to find out whether anything
 * needs them. Only what staff can act on is here; anything waiting on the
 * member appears only once it has gone quiet for long enough to chase.
 */
const adminGetAttention = staffAdminProcedure.query(async () => {
  const now = new Date();

  const [
    paymentsToConfirm,
    reservationsEnding,
    deliveriesToQuote,
    deliveriesSentBack,
    deliveriesStalled,
    offersToDecide,
    applicationsToDecide,
    transfersToStart,
    transfersQuiet,
    ukUnassigned,
    membershipsStuck,
    invoicesToSetUp,
  ] = await Promise.all([
    safely('payments', async () =>
      (
        await db
          .select({
            id: cellarPurchases.id,
            number: cellarPurchases.purchaseNumber,
            name: cellarPurchases.buyerName,
            total: cellarPurchases.totalUsd,
            reference: cellarPurchases.paymentReference,
            since: cellarPurchases.paymentClaimedAt,
          })
          .from(cellarPurchases)
          .where(eq(cellarPurchases.status, 'payment_claimed'))
          .orderBy(asc(cellarPurchases.paymentClaimedAt))
      ).map((row) => ({
        id: row.id,
        title: `${row.name} · ${row.number}`,
        detail: `$${Math.round(row.total).toLocaleString('en-US')}${row.reference ? ` · ref ${row.reference}` : ''}`,
        since: row.since,
      })),
    ),
    safely('reservations', async () =>
      (
        await db
          .select({
            id: cellarPurchases.id,
            number: cellarPurchases.purchaseNumber,
            name: cellarPurchases.buyerName,
            total: cellarPurchases.totalUsd,
            until: cellarPurchases.reservedUntil,
            since: cellarPurchases.createdAt,
          })
          .from(cellarPurchases)
          .where(
            and(
              eq(cellarPurchases.status, 'reserved'),
              lt(cellarPurchases.reservedUntil, new Date(now.getTime() + DAY / 2)),
            ),
          )
          .orderBy(asc(cellarPurchases.reservedUntil))
      ).map((row) => ({
        id: row.id,
        title: `${row.name} · ${row.number}`,
        detail: `$${Math.round(row.total).toLocaleString('en-US')} · hold ends in ${
          row.until
            ? `${Math.max(0, Math.round((row.until.getTime() - now.getTime()) / (60 * 60 * 1000)))}h`
            : 'under 12h'
        }`,
        since: row.since,
      })),
    ),
    safely('to-quote', async () =>
      (
        await db
          .select({
            id: cellarReleaseRequests.id,
            number: cellarReleaseRequests.requestNumber,
            name: partners.businessName,
            since: cellarReleaseRequests.submittedAt,
          })
          .from(cellarReleaseRequests)
          .innerJoin(partners, eq(partners.id, cellarReleaseRequests.partnerId))
          .where(
            or(
              eq(cellarReleaseRequests.status, 'submitted'),
              and(
                eq(cellarReleaseRequests.status, 'under_review'),
                isNull(cellarReleaseRequests.quotedAt),
              ),
            ),
          )
          .orderBy(asc(cellarReleaseRequests.submittedAt))
      ).map((row) => ({
        id: row.id,
        title: `${row.name} · ${row.number}`,
        detail: 'Delivery request waiting for a quote',
        since: row.since,
      })),
    ),
    safely('sent-back', async () =>
      (
        await db
          .select({
            id: cellarReleaseRequests.id,
            number: cellarReleaseRequests.requestNumber,
            name: partners.businessName,
            since: cellarReleaseRequests.updatedAt,
          })
          .from(cellarReleaseRequests)
          .innerJoin(partners, eq(partners.id, cellarReleaseRequests.partnerId))
          .where(
            and(
              eq(cellarReleaseRequests.status, 'revision_requested'),
              lt(cellarReleaseRequests.updatedAt, new Date(now.getTime() - 7 * DAY)),
            ),
          )
          .orderBy(asc(cellarReleaseRequests.updatedAt))
      ).map((row) => ({
        id: row.id,
        title: `${row.name} · ${row.number}`,
        detail: 'Sent back for a change, no reply in a week',
        since: row.since,
      })),
    ),
    safely('stalled', async () =>
      (
        await db
          .select({
            id: cellarReleaseRequests.id,
            number: cellarReleaseRequests.requestNumber,
            name: partners.businessName,
            order: privateClientOrders.orderNumber,
            orderStatus: privateClientOrders.status,
            since: cellarReleaseRequests.confirmedAt,
          })
          .from(cellarReleaseRequests)
          .innerJoin(partners, eq(partners.id, cellarReleaseRequests.partnerId))
          .innerJoin(
            privateClientOrders,
            eq(privateClientOrders.id, cellarReleaseRequests.privateClientOrderId),
          )
          .where(
            and(
              eq(cellarReleaseRequests.status, 'confirmed'),
              notInArray(privateClientOrders.status, ['delivered', 'cancelled']),
              lt(cellarReleaseRequests.confirmedAt, new Date(now.getTime() - 10 * DAY)),
            ),
          )
          .orderBy(asc(cellarReleaseRequests.confirmedAt))
      ).map((row) => ({
        id: row.id,
        title: `${row.name} · ${row.order}`,
        detail: `Accepted over 10 days ago, still ${row.orderStatus.replace(/_/g, ' ')}`,
        since: row.since,
      })),
    ),
    safely('offers', async () =>
      (
        await db
          .select({
            id: saleMandates.id,
            number: saleMandates.mandateNumber,
            name: saleMandates.ownerName,
            wine: saleMandates.productName,
            bottles: saleMandates.bottlesOffered,
            since: saleMandates.offeredAt,
          })
          .from(saleMandates)
          .where(eq(saleMandates.status, 'offered'))
          .orderBy(asc(saleMandates.offeredAt))
      ).map((row) => ({
        id: row.id,
        title: `${row.name} · ${row.number}`,
        detail: `${row.bottles} × ${row.wine}`,
        since: row.since,
      })),
    ),
    safely('applications', async () =>
      (
        await db
          .select({
            id: cellarApplications.id,
            name: cellarApplications.fullName,
            since: cellarApplications.updatedAt,
          })
          .from(cellarApplications)
          .where(eq(cellarApplications.status, 'submitted'))
          .orderBy(asc(cellarApplications.updatedAt))
      ).map((row) => ({
        id: row.id,
        title: row.name ?? 'Unnamed applicant',
        detail: 'Asked to open a private cellar',
        since: row.since,
      })),
    ),
    safely('intakes-new', async () =>
      (
        await db
          .select({
            id: cellarIntakes.id,
            name: partners.businessName,
            source: cellarIntakes.source,
            holder: cellarIntakes.holderName,
            cases: cellarIntakes.approxCases,
            since: cellarIntakes.createdAt,
          })
          .from(cellarIntakes)
          .innerJoin(partners, eq(partners.id, cellarIntakes.partnerId))
          .where(eq(cellarIntakes.stage, 'requested'))
          .orderBy(asc(cellarIntakes.createdAt))
      ).map((row) => ({
        id: row.id,
        title: row.name,
        detail: [row.holder ?? row.source.replace(/_/g, ' '), row.cases ? `about ${row.cases} cases` : null]
          .filter(Boolean)
          .join(' · '),
        since: row.since,
      })),
    ),
    safely('intakes-quiet', async () =>
      (
        await db
          .select({
            id: cellarIntakes.id,
            name: partners.businessName,
            stage: cellarIntakes.stage,
            since: cellarIntakes.updatedAt,
          })
          .from(cellarIntakes)
          .innerJoin(partners, eq(partners.id, cellarIntakes.partnerId))
          .where(
            and(
              inArray(cellarIntakes.stage, ['in_progress', 'arriving_uk', 'shipping_uae']),
              lt(cellarIntakes.updatedAt, new Date(now.getTime() - 21 * DAY)),
            ),
          )
          .orderBy(asc(cellarIntakes.updatedAt))
      ).map((row) => ({
        id: row.id,
        title: row.name,
        detail: `Still at "${row.stage.replace(/_/g, ' ')}" after three weeks`,
        since: row.since,
      })),
    ),
    safely('uk', async () =>
      (
        await db
          .select({
            rotation: cellarUkHoldings.rotation,
            wines: sql<number>`count(*)::int`,
            bottles: sql<number>`coalesce(sum(${cellarUkHoldings.totalBottles}), 0)::int`,
            since: sql<Date | null>`min(${cellarUkHoldings.receivedAt})`,
          })
          .from(cellarUkHoldings)
          .leftJoin(cellarUkRotations, eq(cellarUkRotations.rotation, cellarUkHoldings.rotation))
          .where(
            or(
              isNull(cellarUkRotations.rotation),
              and(isNull(cellarUkRotations.partnerId), eq(cellarUkRotations.isHouse, false)),
            ),
          )
          .groupBy(cellarUkHoldings.rotation)
          .orderBy(cellarUkHoldings.rotation)
      ).map((row) => ({
        id: row.rotation,
        title: `Rotation ${row.rotation}`,
        detail: `${row.wines} ${row.wines === 1 ? 'wine' : 'wines'} · ${row.bottles} bottles`,
        since: row.since ? new Date(row.since) : null,
      })),
    ),
    safely('memberships', async () =>
      (
        await db
          .select({
            id: cellarMemberships.id,
            name: partners.businessName,
            status: cellarMemberships.status,
            since: cellarMemberships.updatedAt,
          })
          .from(cellarMemberships)
          .innerJoin(partners, eq(partners.id, cellarMemberships.partnerId))
          .where(inArray(cellarMemberships.status, ['pending_payment', 'past_due']))
          .orderBy(asc(cellarMemberships.updatedAt))
      ).map((row) => ({
        id: row.id,
        title: row.name,
        detail:
          row.status === 'past_due'
            ? 'Membership payment overdue'
            : 'Started opening their cellar and has not finished',
        since: row.since,
      })),
    ),
    /*
      Activation opens a Team Tasks job to set up the member's Zoho invoice. An
      open one means a member is using their cellar and nobody is billing them.
    */
    safely('invoices', async () =>
      (
        await db
          .select({ id: teamTasks.id, title: teamTasks.title, since: teamTasks.createdAt })
          .from(teamTasks)
          .where(
            and(
              eq(teamTasks.status, 'open'),
              sql`${teamTasks.title} LIKE '% — set up monthly membership invoice'`,
            ),
          )
          .orderBy(asc(teamTasks.createdAt))
      ).map((row) => ({
        id: row.id,
        title: row.title.replace(' — set up monthly membership invoice', ''),
        detail: 'Recurring invoice not yet set up in Zoho Books',
        since: row.since,
      })),
    ),
  ]);

  const group = (
    key: string,
    label: string,
    action: string,
    tone: AttentionGroup['tone'],
    href: string,
    rows: AttentionRow[],
  ): AttentionGroup => ({
    key,
    label,
    action,
    tone,
    href,
    count: rows.length,
    rows: rows.slice(0, SHOWN),
  });

  const groups = [
    group('payments', 'Payments to confirm', 'Check the bank and confirm', 'urgent', '/platform/admin/cellar-purchases', paymentsToConfirm),
    group('reservations', 'Reservations ending', 'Unpaid holds lapsing within 12 hours', 'chase', '/platform/admin/cellar-purchases', reservationsEnding),
    group('to-quote', 'Deliveries to quote', 'Price the delivery and send the quote', 'urgent', '/platform/admin/cellar-releases', deliveriesToQuote),
    group('stalled', 'Deliveries not moving', 'Accepted, but the order has not been delivered', 'chase', '/platform/admin/cellar-releases', deliveriesStalled),
    group('sent-back', 'Deliveries sent back', 'The member has not replied in a week', 'chase', '/platform/admin/cellar-releases', deliveriesSentBack),
    group('offers', 'Offers to decide', 'Accept, send back or decline', 'action', '/platform/admin/consignment', offersToDecide),
    group('applications', 'Applications to decide', 'Approve or decline', 'action', '/platform/admin/cellar-members?tab=applications', applicationsToDecide),
    group('intakes-new', 'Transfers to start', 'A member asked us to bring wine in', 'action', '/platform/admin/cellar-members?tab=intakes', transfersToStart),
    group('intakes-quiet', 'Transfers gone quiet', 'Move the stage on, or find out why not', 'chase', '/platform/admin/cellar-members?tab=intakes', transfersQuiet),
    group('uk', 'UK rotations to assign', 'Wine at LCB no member can see yet', 'action', '/platform/admin/cellar-members?tab=uk', ukUnassigned),
    group('invoices', 'Invoices to set up', 'Active members not yet billed', 'urgent', '/platform/admin/tasks', invoicesToSetUp),
    group('memberships', 'Memberships stuck', 'Activation unfinished or payment overdue', 'chase', '/platform/admin/cellar-members?tab=storage', membershipsStuck),
  ];

  return {
    total: groups.reduce((sum, item) => sum + item.count, 0),
    groups: groups.filter((item) => item.count > 0),
  };
});

export default adminGetAttention;
