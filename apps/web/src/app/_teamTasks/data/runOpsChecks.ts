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
  partners,
  privateClientOrders,
  wmsPickLists,
  zohoSalesOrders,
} from '@/database/schema';

import dubaiToday from '../utils/dubaiToday';

/** One record a check found: becomes one part on that check's job */
export interface OpsFinding {
  recordKey: string;
  /** The part's text: the record, then what to do */
  what: string;
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
    logisticsChecks(now),
  ]);

  const failed = settled.filter((s) => s.status === 'rejected').map((s) => String((s as PromiseRejectedResult).reason));
  const results = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []));

  return { results, failed };
};

export default runOpsChecks;
