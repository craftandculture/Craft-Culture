import { and, eq, inArray, isNull, lt, notInArray, sql } from 'drizzle-orm';

import getDeliveryLinkExceptions from '@/app/_cellar/data/getDeliveryLinkExceptions';
import type { DeliveryLinkExceptionKind } from '@/app/_cellar/data/getDeliveryLinkExceptions';
import getAttentionGroups from '@/app/_logistics/data/getAttentionGroups';
import {
  DISTRIBUTOR_SKU_LOCKED_STATUSES,
  PCO_STAGES,
} from '@/app/_privateClientOrders/constants';
import db from '@/database/client';
import type { PrivateClientOrder } from '@/database/schema';
import {
  cellarApplications,
  cellarInvites,
  cellarReleaseRequests,
  cellarSourcingRequests,
  cellarUkMoves,
  partners,
  privateClientOrders,
  quotes,
  wmsPartnerRequests,
  wmsPickLists,
  zohoSalesOrders,
} from '@/database/schema';

import dubaiToday from '../utils/dubaiToday';

/** One record a check found: becomes one part on that check's job */
export interface OpsFinding {
  recordKey: string;
  /** The part's text: the record, then what to do */
  what: string;
  /** Who gets this part, by email, when it is not the check's owner */
  ownerEmail?: string;
  /** The record itself in the Index (a path), so a Slack line opens it */
  url?: string;
}

/** A check's result: the job it keeps open, and what it found this run */
export interface OpsCheckResult {
  key: string;
  /** The job's title while anything is found */
  title: string;
  area: 'Orders' | 'Logistics' | 'Private Cellar' | 'Warehouse';
  /** Who gets each part, by email; the first is tagged on urgent posts */
  owners: string[];
  /** Posted to #tasks the moment a new record is found */
  urgent: boolean;
  /** Where the job links: the screen that lists these records */
  linkUrl: string;
  findings: OpsFinding[];
  /**
   * False when the source list was cut short, so a record missing from it may
   * still be a problem: nothing is ticked off for this check on such a run
   */
  complete: boolean;
}

const LARAINE = 'laraine@craftculture.xyz';
const JYOTHI = 'jyothi@craftculture.xyz';
const SOPHIE = 'sophie@craftculture.xyz';
const KEVIN = 'kevin@craftculture.xyz';
const WAREHOUSE = 'warehouse@craftculture.xyz';

const DAY = 24 * 60 * 60 * 1000;
const PCO_LIST = '/platform/admin/private-orders';

const pcoLabel = (row: { orderNumber: string; clientName: string | null }) =>
  `${row.orderNumber}${row.clientName ? ` · ${row.clientName}` : ''}`;

/** Orders that are live: not delivered, not cancelled */
const LIVE_STATUSES = [
  ...PCO_STAGES.review,
  ...PCO_STAGES.verification,
  ...PCO_STAGES.payment,
  ...PCO_STAGES.fulfilment,
] as PrivateClientOrder['status'][];

const pcoChecks = async (now: Date): Promise<OpsCheckResult[]> => {
  const notYetShipped = [
    ...PCO_STAGES.review,
    ...PCO_STAGES.verification,
    ...PCO_STAGES.payment,
  ] as PrivateClientOrder['status'][];
  const columns = {
    id: privateClientOrders.id,
    orderNumber: privateClientOrders.orderNumber,
    clientName: privateClientOrders.clientName,
  };

  const [noDistributor, noSku, idle] = await Promise.all([
    db
      .select(columns)
      .from(privateClientOrders)
      .where(
        and(
          isNull(privateClientOrders.distributorId),
          inArray(privateClientOrders.status, [
            ...PCO_STAGES.verification,
            ...PCO_STAGES.payment,
          ] as PrivateClientOrder['status'][]),
        ),
      ),
    db
      .select(columns)
      .from(privateClientOrders)
      .innerJoin(partners, eq(privateClientOrders.distributorId, partners.id))
      .where(
        and(
          eq(partners.requiresOrderSku, true),
          isNull(privateClientOrders.distributorSku),
          notInArray(
            privateClientOrders.status,
            DISTRIBUTOR_SKU_LOCKED_STATUSES as PrivateClientOrder['status'][],
          ),
          inArray(privateClientOrders.status, notYetShipped),
        ),
      ),
    db
      .select({ ...columns, status: privateClientOrders.status })
      .from(privateClientOrders)
      .where(
        and(
          inArray(privateClientOrders.status, LIVE_STATUSES),
          lt(privateClientOrders.updatedAt, new Date(now.getTime() - 7 * DAY)),
        ),
      ),
  ]);

  return [
    {
      key: 'pco_no_distributor',
      title: 'PCOs with no distributor',
      area: 'Orders',
      owners: [LARAINE],
      urgent: false,
      linkUrl: PCO_LIST,
      complete: true,
      findings: noDistributor.map((r) => ({
        recordKey: r.id,
        what: `${pcoLabel(r)}: assign a distributor`,
        url: `${PCO_LIST}/${r.id}`,
      })),
    },
    {
      key: 'pco_no_cd_sku',
      title: 'PCOs missing the City Drinks SKU',
      area: 'Orders',
      owners: [LARAINE],
      urgent: false,
      linkUrl: PCO_LIST,
      complete: true,
      findings: noSku.map((r) => ({
        recordKey: r.id,
        what: `${pcoLabel(r)}: add the CD SKU`,
        url: `${PCO_LIST}/${r.id}`,
      })),
    },
    {
      key: 'pco_idle',
      title: 'PCOs with no change for 7 days',
      area: 'Orders',
      owners: [LARAINE],
      urgent: false,
      linkUrl: PCO_LIST,
      complete: true,
      findings: idle.map((r) => ({
        recordKey: r.id,
        what: `${pcoLabel(r)}: chase (${r.status.replace(/_/g, ' ')})`,
        url: `${PCO_LIST}/${r.id}`,
      })),
    },
  ];
};

/**
 * Two live orders for the same client carrying exactly the same wines
 *
 * The PCO-2026-00105 case: a release raised its own order beside one the team
 * had raised by hand, and both could have been picked and invoiced.
 */
const duplicateCheck = async (): Promise<OpsCheckResult> => {
  const result = await db.execute<{ ids: string[]; numbers: string[]; name: string }>(sql`
    WITH live AS (
      SELECT o.id, o.order_number, o.client_name, o.created_at,
             lower(trim(o.client_name)) AS client_key,
             (SELECT string_agg(DISTINCT i.lwin, ',' ORDER BY i.lwin)
                FROM private_client_order_items i
               WHERE i.order_id = o.id) AS wines
        FROM private_client_orders o
       WHERE o.status::text NOT IN ('draft', 'delivered', 'cancelled')
         AND o.client_name IS NOT NULL
    )
    SELECT array_agg(id::text ORDER BY order_number) AS ids,
           array_agg(order_number ORDER BY order_number) AS numbers,
           min(client_name) AS name
      FROM live
     WHERE wines IS NOT NULL
     GROUP BY client_key, wines
    HAVING count(*) > 1
       AND max(created_at) - min(created_at) < interval '30 days'
  `);
  const rows = Array.isArray(result) ? result : (result as { rows: typeof result }).rows;

  return {
    key: 'pco_duplicate',
    title: 'Possible duplicate PCOs',
    area: 'Orders',
    owners: [LARAINE],
    urgent: true,
    linkUrl: PCO_LIST,
    complete: true,
    findings: rows.map((r) => ({
      recordKey: r.ids.join('+'),
      what: `${r.numbers.join(' and ')} · ${r.name}: same client, same wines. Cancel the extra one`,
    })),
  };
};

/**
 * A delivery booked for today, or missed in the last week, whose order has no pick list yet
 *
 * Keyed by order alone and kept while the delivery is overdue. Keyed by order
 * and date, and found only on the day itself, an unresolved item vanished at
 * midnight and was ticked off as put right.
 */
const deliveryTodayCheck = async (): Promise<OpsCheckResult> => {
  const today = dubaiToday();
  const deliveryDay = sql<string>`to_char((${privateClientOrders.scheduledDeliveryDate} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Dubai')::date, 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      id: privateClientOrders.id,
      orderNumber: privateClientOrders.orderNumber,
      clientName: privateClientOrders.clientName,
      deliveryDay,
    })
    .from(privateClientOrders)
    .where(
      and(
        inArray(privateClientOrders.status, LIVE_STATUSES),
        sql`(${privateClientOrders.scheduledDeliveryDate} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Dubai')::date BETWEEN ${today}::date - 7 AND ${today}::date`,
        sql`NOT EXISTS (
          SELECT 1 FROM ${wmsPickLists}
          WHERE ${wmsPickLists.orderId} = ${privateClientOrders.id}
             OR ${wmsPickLists.orderId} IN (
               SELECT ${zohoSalesOrders.id} FROM ${zohoSalesOrders}
               WHERE ${zohoSalesOrders.privateClientOrderId} = ${privateClientOrders.id}
             )
        )`,
      ),
    );

  return {
    key: 'delivery_today_no_pick',
    title: 'Deliveries due with no pick list',
    area: 'Warehouse',
    owners: [LARAINE],
    urgent: true,
    linkUrl: PCO_LIST,
    complete: true,
    findings: rows.map((r) => ({
      recordKey: r.id,
      what:
        r.deliveryDay === today
          ? `${pcoLabel(r)}: delivery booked today, raise the pick list`
          : `${pcoLabel(r)}: delivery was booked for ${r.deliveryDay} and has no pick list`,
    })),
  };
};

const CELLAR: Record<
  DeliveryLinkExceptionKind,
  Pick<OpsCheckResult, 'title' | 'area' | 'owners' | 'urgent'>
> = {
  no_order: {
    title: 'Releases accepted with no order raised',
    area: 'Private Cellar',
    owners: [SOPHIE],
    urgent: false,
  },
  no_sales_order: {
    title: 'Release orders with no Zoho sales order',
    area: 'Private Cellar',
    owners: [LARAINE],
    urgent: false,
  },
  unknown_pco_reference: {
    title: 'Zoho sales orders quoting a PCO that does not exist',
    area: 'Orders',
    owners: [LARAINE],
    urgent: false,
  },
  wrong_owner_pick: {
    title: "Deliveries picked from another owner's bottles",
    area: 'Warehouse',
    owners: [WAREHOUSE, KEVIN],
    urgent: true,
  },
  bills_wine: {
    title: 'Release orders billing wine the member owns',
    area: 'Private Cellar',
    owners: [SOPHIE],
    urgent: false,
  },
};

const cellarChecks = async (): Promise<OpsCheckResult[]> => {
  const rows = await getDeliveryLinkExceptions();

  return (Object.keys(CELLAR) as DeliveryLinkExceptionKind[]).map((kind) => ({
    key: `cellar_${kind}`,
    ...CELLAR[kind],
    linkUrl: '/platform/admin/cellar-members',
    complete: true,
    findings: rows
      .filter((r) => r.kind === kind)
      .map((r) => ({ recordKey: r.id, what: `${r.title}: ${r.detail}` })),
  }));
};

const MEMBERS = '/platform/admin/cellar-members';

/** One record for both cellar reviewers, keyed apart so each has a part */
const forBoth = (recordKey: string, what: string, url?: string): OpsFinding[] => [
  { recordKey, what, ownerEmail: SOPHIE, url },
  { recordKey: `${recordKey}:laraine`, what, ownerEmail: LARAINE, url },
];

const RELEASES_LIST = '/platform/admin/cellar-releases';

const shortDay = (d: Date | null) =>
  d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' }) : null;

/**
 * Member release requests that are waiting on C&C, and quotes waiting on the member
 *
 * REL-2026-0012 sat "Awaiting review" for three days because nothing told
 * anyone it had arrived: the Releases screen only shows it to whoever opens
 * it. A request the member has submitted, or sent back for changes, is now a
 * job with a named owner, tagged in #tasks as soon as it lands. A quote the
 * member has not answered in three days becomes a chase.
 */
const releaseChecks = async (now: Date): Promise<OpsCheckResult[]> => {
  const columns = {
    id: cellarReleaseRequests.id,
    requestNumber: cellarReleaseRequests.requestNumber,
    status: cellarReleaseRequests.status,
    submittedAt: cellarReleaseRequests.submittedAt,
    quotedAt: cellarReleaseRequests.quotedAt,
    updatedAt: cellarReleaseRequests.updatedAt,
    member: partners.businessName,
  };

  const [waitingOnUs, waitingOnMember, toPrepare] = await Promise.all([
    db
      .select(columns)
      .from(cellarReleaseRequests)
      .innerJoin(partners, eq(partners.id, cellarReleaseRequests.partnerId))
      .where(inArray(cellarReleaseRequests.status, ['submitted', 'revision_requested'])),
    db
      .select(columns)
      .from(cellarReleaseRequests)
      .innerJoin(partners, eq(partners.id, cellarReleaseRequests.partnerId))
      .where(
        and(
          eq(cellarReleaseRequests.status, 'under_review'),
          lt(
            sql`coalesce(${cellarReleaseRequests.quotedAt}, ${cellarReleaseRequests.updatedAt})`,
            // A Date beside raw SQL is not encoded and fails at runtime; bind it as text
            sql`${new Date(now.getTime() - 3 * DAY).toISOString()}::timestamp`,
          ),
        ),
      ),
    /*
      Accepted by the member, so the order exists, but nothing has been
      picked for it yet: the sales order, pick and delivery are ours to start.
    */
    db
      .select({
        id: cellarReleaseRequests.id,
        requestNumber: cellarReleaseRequests.requestNumber,
        orderNumber: privateClientOrders.orderNumber,
        orderId: privateClientOrders.id,
        confirmedAt: cellarReleaseRequests.confirmedAt,
        member: partners.businessName,
      })
      .from(cellarReleaseRequests)
      .innerJoin(partners, eq(partners.id, cellarReleaseRequests.partnerId))
      .innerJoin(privateClientOrders, eq(privateClientOrders.id, cellarReleaseRequests.privateClientOrderId))
      .where(
        and(
          eq(cellarReleaseRequests.status, 'confirmed'),
          notInArray(privateClientOrders.status, ['delivered', 'cancelled']),
          sql`NOT EXISTS (
            SELECT 1 FROM ${wmsPickLists}
            WHERE ${wmsPickLists.orderId} = ${privateClientOrders.id}
               OR ${wmsPickLists.orderId} IN (
                 SELECT ${zohoSalesOrders.id} FROM ${zohoSalesOrders}
                 WHERE ${zohoSalesOrders.privateClientOrderId} = ${privateClientOrders.id}
               )
          )`,
        ),
      ),
  ]);

  return [
    {
      key: 'cellar_release_review',
      title: 'Release requests to review',
      area: 'Private Cellar',
      owners: [SOPHIE, LARAINE, KEVIN],
      // Posted the moment it happens (emailStaffOfRelease); this job keeps it open and chases it
      urgent: false,
      linkUrl: RELEASES_LIST,
      complete: true,
      /*
        Sophie sets the prices; Laraine gets the same part so a request is
        never left with one person who is out or busy. Sending the quote ticks
        both.
      */
      findings: waitingOnUs.flatMap((r) => {
        const since = shortDay(r.submittedAt ?? r.updatedAt);
        const action =
          r.status === 'revision_requested'
            ? 'member asked for changes, revise the quote'
            : 'set the prices and send the quote';
        const what = `${r.requestNumber} · ${r.member}: ${action}${since ? ` (since ${since})` : ''}`;
        // Keyed by status too: a request sent back for changes is new work
        const key = `${r.id}:${r.status}`;
        return forBoth(key, what, `${RELEASES_LIST}?open=${r.id}`);
      }),
    },
    {
      key: 'cellar_release_accepted',
      title: 'Accepted releases to prepare',
      area: 'Private Cellar',
      owners: [LARAINE, SOPHIE, KEVIN],
      // Posted the moment it happens (emailStaffOfRelease); this job keeps it open and chases it
      urgent: false,
      linkUrl: RELEASES_LIST,
      complete: true,
      findings: toPrepare.flatMap((r) =>
        forBoth(
          r.id,
          `${r.requestNumber} · ${r.orderNumber} · ${r.member}: member accepted${
            r.confirmedAt ? ` ${shortDay(r.confirmedAt)}` : ''
          }. Raise the sales order and pick list, book the delivery`,
          `${PCO_LIST}/${r.orderId}`,
        ),
      ),
    },
    {
      key: 'cellar_release_member_idle',
      title: 'Release quotes the member has not answered',
      area: 'Private Cellar',
      owners: [SOPHIE, LARAINE, KEVIN],
      urgent: false,
      linkUrl: RELEASES_LIST,
      complete: true,
      findings: waitingOnMember.map((r) => ({
        recordKey: r.id,
        what: `${r.requestNumber} · ${r.member}: quoted ${shortDay(r.quotedAt ?? r.updatedAt)}, no answer yet. Chase the member`,
        url: `${RELEASES_LIST}?open=${r.id}`,
      })),
    },
  ];
};

/**
 * Everything a member, applicant or partner sends in that waits on the team,
 * and anything of ours that has stalled on their side
 *
 * Each of these lived only on its own screen, so it waited until someone
 * happened to open that screen: an application sat unseen, an invited member
 * stopped half-way through joining and nobody followed up. Waiting on us is
 * urgent and tagged in #tasks; waiting on them is a chase in the day's report.
 */
const intakeChecks = async (now: Date): Promise<OpsCheckResult[]> => {
  const twoDaysAgo = new Date(now.getTime() - 2 * DAY);
  const threeDaysAgo = new Date(now.getTime() - 3 * DAY);

  const [
    applied,
    filling,
    invites,
    sourcing,
    ukNew,
    ukQuoted,
    buyRequests,
    pcoReview,
    partnerRequests,
  ] = await Promise.all([
    db
      .select({ id: cellarApplications.id, name: cellarApplications.fullName, at: cellarApplications.submittedAt })
      .from(cellarApplications)
      .where(eq(cellarApplications.status, 'submitted')),
    db
      .select({
        id: cellarApplications.id,
        name: cellarApplications.fullName,
        phone: cellarApplications.phone,
        at: cellarApplications.updatedAt,
      })
      .from(cellarApplications)
      .where(and(eq(cellarApplications.status, 'draft'), lt(cellarApplications.updatedAt, twoDaysAgo))),
    db
      .select({ id: cellarInvites.id, name: cellarInvites.name, email: cellarInvites.email, at: cellarInvites.lastSentAt })
      .from(cellarInvites)
      .where(
        and(
          eq(cellarInvites.status, 'sent'),
          isNull(cellarInvites.acceptedAt),
          lt(
            sql`coalesce(${cellarInvites.lastSentAt}, ${cellarInvites.createdAt})`,
            sql`${threeDaysAgo.toISOString()}::timestamp`,
          ),
        ),
      ),
    db
      .select({
        id: cellarSourcingRequests.id,
        number: cellarSourcingRequests.requestNumber,
        wine: cellarSourcingRequests.wineName,
        member: partners.businessName,
      })
      .from(cellarSourcingRequests)
      .innerJoin(partners, eq(partners.id, cellarSourcingRequests.partnerId))
      .where(eq(cellarSourcingRequests.status, 'requested')),
    db
      .select({ id: cellarUkMoves.id, number: cellarUkMoves.moveNumber, member: partners.businessName })
      .from(cellarUkMoves)
      .innerJoin(partners, eq(partners.id, cellarUkMoves.partnerId))
      .where(eq(cellarUkMoves.status, 'submitted')),
    db
      .select({
        id: cellarUkMoves.id,
        number: cellarUkMoves.moveNumber,
        member: partners.businessName,
        at: cellarUkMoves.quotedAt,
      })
      .from(cellarUkMoves)
      .innerJoin(partners, eq(partners.id, cellarUkMoves.partnerId))
      .where(and(eq(cellarUkMoves.status, 'quoted'), lt(cellarUkMoves.quotedAt, threeDaysAgo))),
    db
      .select({ id: quotes.id, name: quotes.name, client: quotes.clientName, status: quotes.status })
      .from(quotes)
      .where(inArray(quotes.status, ['buy_request_submitted', 'under_cc_review', 'po_submitted'])),
    db
      .select({
        id: privateClientOrders.id,
        orderNumber: privateClientOrders.orderNumber,
        clientName: privateClientOrders.clientName,
        status: privateClientOrders.status,
      })
      .from(privateClientOrders)
      .where(inArray(privateClientOrders.status, ['submitted', 'under_cc_review'])),
    db
      .select({
        id: wmsPartnerRequests.id,
        number: wmsPartnerRequests.requestNumber,
        type: wmsPartnerRequests.requestType,
        product: wmsPartnerRequests.productName,
        partner: partners.businessName,
      })
      .from(wmsPartnerRequests)
      .innerJoin(partners, eq(partners.id, wmsPartnerRequests.partnerId))
      .where(eq(wmsPartnerRequests.status, 'pending')),
  ]);

  const cellar = { area: 'Private Cellar' as const, owners: [SOPHIE, LARAINE, KEVIN], complete: true };

  return [
    {
      ...cellar,
      key: 'cellar_application_review',
      title: 'Cellar applications to review',
      urgent: true,
      linkUrl: `${MEMBERS}?tab=applications`,
      findings: applied.flatMap((r) =>
        forBoth(r.id, `${r.name ?? 'Applicant'}: review the application, approve or decline (since ${shortDay(r.at)})`),
      ),
    },
    {
      ...cellar,
      key: 'cellar_application_stalled',
      title: 'Cellar applications not finished',
      urgent: false,
      linkUrl: `${MEMBERS}?tab=applications`,
      findings: filling.flatMap((r) =>
        forBoth(
          r.id,
          `${r.name ?? 'Applicant'}${r.phone ? ` (${r.phone})` : ''}: started joining, no progress since ${shortDay(r.at)}. Call or WhatsApp to help them finish`,
        ),
      ),
    },
    {
      ...cellar,
      key: 'cellar_invite_unanswered',
      title: 'Cellar invites not taken up',
      urgent: false,
      linkUrl: `${MEMBERS}?tab=invites`,
      findings: invites.flatMap((r) =>
        forBoth(r.id, `${r.name ?? r.email}: invited ${shortDay(r.at) ?? ''}, has not started. Follow up or resend`),
      ),
    },
    {
      ...cellar,
      key: 'cellar_sourcing_new',
      title: 'Member sourcing requests to pick up',
      urgent: true,
      linkUrl: `${MEMBERS}?tab=requests`,
      findings: sourcing.flatMap((r) => forBoth(r.id, `${r.number} · ${r.member}: ${r.wine}. Start the search`)),
    },
    {
      ...cellar,
      key: 'cellar_uk_move_new',
      title: 'UK move requests to quote',
      urgent: true,
      linkUrl: `${MEMBERS}?tab=uk-moves`,
      findings: ukNew.flatMap((r) => forBoth(r.id, `${r.number} · ${r.member}: price the move and send the quote`)),
    },
    {
      ...cellar,
      key: 'cellar_uk_move_idle',
      title: 'UK move quotes the member has not answered',
      urgent: false,
      linkUrl: `${MEMBERS}?tab=uk-moves`,
      findings: ukQuoted.map((r) => ({
        recordKey: r.id,
        what: `${r.number} · ${r.member}: quoted ${shortDay(r.at)}, no answer yet. Chase the member`,
      })),
    },
    {
      key: 'partner_quote_review',
      title: 'Partner buy requests and POs to confirm',
      area: 'Orders',
      owners: [LARAINE, KEVIN],
      urgent: true,
      linkUrl: '/platform/admin/quote-approvals',
      complete: true,
      findings: buyRequests.map((r) => ({
        // Keyed by status: a PO after an approved buy request is new work
        recordKey: `${r.id}:${r.status}`,
        what: `${r.name ?? 'Quote'}${r.client ? ` · ${r.client}` : ''}: ${
          r.status === 'po_submitted' ? 'PO received, confirm it' : 'buy request, review and confirm'
        }`,
      })),
    },
    {
      key: 'pco_review',
      title: 'PCOs waiting for C&C review',
      area: 'Orders',
      owners: [LARAINE, KEVIN],
      urgent: true,
      linkUrl: PCO_LIST,
      complete: true,
      findings: pcoReview.map((r) => ({ recordKey: r.id, what: `${pcoLabel(r)}: review and approve`, url: `${PCO_LIST}/${r.id}` })),
    },
    {
      key: 'partner_wms_request',
      title: 'Partner warehouse requests',
      area: 'Warehouse',
      owners: [WAREHOUSE, KEVIN],
      urgent: true,
      linkUrl: '/platform/admin/wms',
      complete: true,
      findings: partnerRequests.map((r) => ({
        recordKey: r.id,
        what: `${r.number} · ${r.partner}: ${String(r.type).replace(/_/g, ' ')}${r.product ? ` for ${r.product}` : ''}`,
      })),
    },
  ];
};

const LOGISTICS: Record<string, { key: string; title: string; action: string }> = {
  overdue: {
    key: 'shipment_overdue',
    title: 'Shipments past their ETA',
    action: 'confirm where it is, or receive it',
  },
  no_quantities: {
    key: 'shipment_no_quantities',
    title: 'Shipments with no cases or bottles',
    action: 'enter the quantities',
  },
  no_invoice: {
    key: 'export_no_invoice',
    title: 'Export jobs with no invoice',
    action: 'issue the export invoice',
  },
};

/** The logistics groups lists stop at this many, so a full list may be cut */
const LOGISTICS_LIST_LIMIT = 25;

const logisticsChecks = async (now: Date): Promise<OpsCheckResult[]> => {
  const groups = await getAttentionGroups(now);

  return Object.entries(LOGISTICS).map(([groupKey, check]) => {
    const shipments = groups.find((g) => g.key === groupKey)?.shipments ?? [];
    return {
      key: check.key,
      title: check.title,
      area: 'Logistics' as const,
      owners: [JYOTHI],
      urgent: false,
      linkUrl: '/platform/admin/logistics',
      complete: shipments.length < LOGISTICS_LIST_LIMIT,
      findings: shipments.map((s) => {
        const client = 'clientName' in s ? s.clientName : null;
        return {
          recordKey: s.id,
          what: `${s.jobNumber ?? s.shipmentNumber ?? 'Shipment'}${client ? ` · ${client}` : ''}: ${check.action}`,
        };
      }),
    };
  });
};

/**
 * Run every ops check the Index has, for the Team Tasks sync
 *
 * Each check reuses the query behind a screen that already lists these
 * problems, so a job and its screen always agree. A check that fails is left
 * out of this run rather than stopping the others; its job is left as it is.
 *
 * @example
 *   const results = await runOpsChecks();
 *
 * @param now - The moment to judge by
 * @returns One result per check that ran
 */
const runOpsChecks = async (now = new Date()) => {
  const settled = await Promise.allSettled([
    pcoChecks(now),
    duplicateCheck().then((r) => [r]),
    deliveryTodayCheck().then((r) => [r]),
    cellarChecks(),
    releaseChecks(now),
    intakeChecks(now),
    logisticsChecks(now),
  ]);

  const failed = settled.filter((s) => s.status === 'rejected').map((s) => String((s as PromiseRejectedResult).reason));
  const results = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []));

  return { results, failed };
};

export default runOpsChecks;
