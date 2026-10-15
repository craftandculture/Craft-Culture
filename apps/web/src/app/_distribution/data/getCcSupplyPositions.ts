import { and, eq, gt, inArray, or, sql } from 'drizzle-orm';

import getCommittedBottles from '@/app/_consignment/data/getCommittedBottles';
import INBOUND_SHIPMENT_STATUSES, {
  AT_WAREHOUSE_STATUSES,
} from '@/app/_wms/utils/inboundShipmentStatuses';
import inOurWarehouse from '@/app/_wms/utils/inOurWarehouse';
import normalizeLwin18 from '@/app/_wms/utils/normalizeLwin18';
import db, { client } from '@/database/client';
import {
  logisticsShipmentItems,
  logisticsShipments,
  wmsStock,
} from '@/database/schema';

/** What C&C can supply of one wine (any pack), in bottles */
export interface SupplyPosition {
  /** Ours, free to sell: not held for a mandate, not marked not-for-sale */
  stock: number;
  /** Held for a consignor (Crurated), theirs to place */
  consignor: number;
  consignorName: string | null;
  /** On its way to us */
  inbound: number;
  /** Earliest arrival across the shipments carrying it, ISO date */
  inboundEta: string | null;
  /** Pack we hold it in, for whole-case suggestions */
  pack: number | null;
}

/** Wine + vintage + bottle size: one position whatever the pack */
export const wineKeyOf = (lwin18: string) => {
  const parts = lwin18.split('-');
  return parts.length === 4 ? `${parts[0]}-${parts[1]}-${parts[3]}` : null;
};

/** The same wine across vintages, at one bottle size */
export const familyKeyOf = (lwin18: string) => {
  const parts = lwin18.split('-');
  return parts.length === 4 ? `${parts[0]}-${parts[3]}` : null;
};

const dashed = (code: string | null) => {
  const lwin = normalizeLwin18(String(code ?? '').trim());
  return /^\d{7}-\d{4}-\d{2}-\d{5}$/.test(lwin) ? lwin : null;
};

/**
 * Everything C&C holds or has coming, by wine and by family of vintages
 *
 * The same reading the purchasing reconcile uses: free stock at our warehouse
 * net of mandate commitments, consignor stock kept apart, and inbound
 * shipments with their earliest ETA (goods-in counts as arriving now).
 *
 * @returns Positions keyed by wineKeyOf, and per-family vintages
 */
const getCcSupplyPositions = async () => {
  const owners = await client<{ name: string; match: string }[]>`
    SELECT name, wms_owner_match AS match
    FROM cons_owners
    WHERE is_active AND NULLIF(TRIM(wms_owner_match), '') IS NOT NULL
      AND name !~* 'craft'
  `;
  const consignorOf = (ownerName: string | null) => {
    const name = String(ownerName ?? '').toLowerCase();
    return owners.find((owner) => name.includes(owner.match.toLowerCase()))?.name ?? null;
  };

  const positions = new Map<string, SupplyPosition>();
  const families = new Map<string, Map<string, { stock: number; inbound: number }>>();

  const positionOf = (key: string) => {
    const existing = positions.get(key);
    if (existing) return existing;
    const fresh: SupplyPosition = {
      stock: 0,
      consignor: 0,
      consignorName: null,
      inbound: 0,
      inboundEta: null,
      pack: null,
    };
    positions.set(key, fresh);
    return fresh;
  };

  const addToFamily = (lwin18: string, field: 'stock' | 'inbound', bottles: number) => {
    const family = familyKeyOf(lwin18);
    if (!family) return;
    const vintages = families.get(family) ?? new Map();
    const vintage = lwin18.split('-')[1] ?? '';
    const year = vintages.get(vintage) ?? { stock: 0, inbound: 0 };
    year[field] += bottles;
    vintages.set(vintage, year);
    families.set(family, vintages);
  };

  const stockRows = await db
    .select({
      id: wmsStock.id,
      lwin18: wmsStock.lwin18,
      caseConfig: wmsStock.caseConfig,
      availableCases: wmsStock.availableCases,
      openBottles: wmsStock.openBottles,
      ownerName: wmsStock.ownerName,
    })
    .from(wmsStock)
    .where(
      and(
        eq(wmsStock.notForSale, false),
        inOurWarehouse(),
        or(gt(wmsStock.availableCases, 0), gt(wmsStock.openBottles, 0)),
      ),
    );

  const committed = await getCommittedBottles(stockRows.map((row) => row.id));

  stockRows.forEach((row) => {
    const lwin18 = dashed(row.lwin18);
    const key = lwin18 ? wineKeyOf(lwin18) : null;
    if (!lwin18 || !key) return;
    const free = Math.max(
      0,
      (row.availableCases ?? 0) * (row.caseConfig ?? 1) +
        (row.openBottles ?? 0) -
        (committed.get(row.id) ?? 0),
    );
    if (free <= 0) return;

    const position = positionOf(key);
    const consignor = consignorOf(row.ownerName);
    if (consignor) {
      position.consignor += free;
      position.consignorName = consignor;
    } else {
      position.stock += free;
    }
    // The largest pack we hold is the case we would ship
    if ((row.caseConfig ?? 0) > (position.pack ?? 0)) position.pack = row.caseConfig;
    addToFamily(lwin18, 'stock', free);
  });

  const inboundRows = await db
    .select({
      lwin: logisticsShipmentItems.lwin,
      bottlesPerCase: logisticsShipmentItems.bottlesPerCase,
      bottles: sql<number>`COALESCE(
        NULLIF(${logisticsShipmentItems.totalBottles}, 0),
        COALESCE(${logisticsShipmentItems.cases}, 0) * COALESCE(${logisticsShipmentItems.bottlesPerCase}, 12)
      )::int`,
      status: logisticsShipments.status,
      eta: logisticsShipments.eta,
    })
    .from(logisticsShipmentItems)
    .innerJoin(logisticsShipments, eq(logisticsShipmentItems.shipmentId, logisticsShipments.id))
    .where(
      and(
        inArray(logisticsShipments.status, [...INBOUND_SHIPMENT_STATUSES]),
        sql`COALESCE(${logisticsShipmentItems.notForSale}, ${logisticsShipments.notForSale}) = false`,
      ),
    );

  inboundRows.forEach((row) => {
    const lwin18 = dashed(row.lwin);
    const key = lwin18 ? wineKeyOf(lwin18) : null;
    const bottles = Math.max(0, Number(row.bottles) || 0);
    if (!lwin18 || !key || bottles <= 0) return;

    const position = positionOf(key);
    position.inbound += bottles;
    if (!position.pack && row.bottlesPerCase) position.pack = row.bottlesPerCase;
    const eta = (AT_WAREHOUSE_STATUSES as readonly string[]).includes(row.status)
      ? new Date().toISOString()
      : row.eta
        ? new Date(row.eta).toISOString()
        : null;
    if (eta && (!position.inboundEta || eta < position.inboundEta)) {
      position.inboundEta = eta;
    }
    addToFamily(lwin18, 'inbound', bottles);
  });

  return { positions, families };
};

export default getCcSupplyPositions;
