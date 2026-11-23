import { client } from '@/database/client';

import type { PartnerPayoutCost } from './getPartnerPayoutCost';
import tableReady from '../utils/tableReady';
import wineKey from '../utils/wineKey';

export interface LotPayoutCost {
  /** Weighted over the lots picked for the invoice, USD per bottle */
  perBottle: number;
  bottles: number;
  /** The lots it came from, so a statement line can be traced */
  from: string;
}

interface PickedLot {
  docRef: string;
  lwin18: string;
  lotNumber: string | null;
  bottles: number;
  lotImport: number | null;
  lotLogistics: number | null;
  lotOverride: number | null;
  shipmentImport: number | null;
  shipmentNumber: string | null;
}

/**
 * What an owner is owed per bottle for the wine that went out on each invoice,
 * from the lots actually picked for it
 *
 * One wine can come in twice at two costs: Montille Chassagne 2022 by ocean
 * (import $63.97, no freight) and again by air on SHP-2026-0041 ($43.02 +
 * $12.80). Priced once per wine, every bottle took one lot's figure. Here each
 * invoice is traced to its sales order's picks and each picked lot is costed
 * on its own: the lot's own cost fields where set (`wms_lot_costs`), then its
 * shipment line's import, then the Pricing Manager's figure for the wine.
 *
 * @example
 *   const byLine = await getLotPayoutCosts(partnerId, ['INV-000329'], payout);
 *   byLine.get('INV-000329|1063145202200750')?.perBottle; // 63.97
 *
 * @param partnerId - The owner's partner record
 * @param docRefs - The invoices to trace
 * @param wineCosts - The owner's per-wine Pricing Manager costs, keyed by wine key
 * @returns Cost per bottle per invoice and wine (`docRef|wineKey`)
 */
const getLotPayoutCosts = async (
  partnerId: string,
  docRefs: string[],
  wineCosts: Map<string, PartnerPayoutCost>,
) => {
  const result = new Map<string, LotPayoutCost>();

  if (docRefs.length === 0) return result;

  const hasLotCosts = await tableReady('wms_lot_costs');
  const refs = JSON.stringify([...new Set(docRefs)]);

  const picked = await client<PickedLot[]>`
    SELECT so.invoice_number AS "docRef",
           COALESCE(m.lwin18, s.lwin18) AS lwin18,
           COALESCE(m.lot_number, s.lot_number) AS "lotNumber",
           SUM(COALESCE(m.quantity_bottles,
                        m.quantity_cases * COALESCE(s.case_config, 1)))::float8 AS bottles,
           ${hasLotCosts ? client`MAX(lc.import_price_per_bottle)::float8` : client`NULL::float8`} AS "lotImport",
           ${hasLotCosts ? client`MAX(lc.logistics_per_bottle)::float8` : client`NULL::float8`} AS "lotLogistics",
           ${hasLotCosts ? client`MAX(lc.cost_override_per_bottle)::float8` : client`NULL::float8`} AS "lotOverride",
           MAX(ship.product_cost)::float8 AS "shipmentImport",
           MAX(ls.shipment_number) AS "shipmentNumber"
    FROM wms_stock_movements m
    JOIN zoho_sales_orders so ON so.id = m.order_id
    LEFT JOIN wms_stock s ON s.id = m.stock_id
    LEFT JOIN logistics_shipments ls ON ls.id = COALESCE(m.shipment_id, s.shipment_id)
    LEFT JOIN LATERAL (
      SELECT i.product_cost_per_bottle AS product_cost
      FROM logistics_shipment_items i
      WHERE i.shipment_id = COALESCE(m.shipment_id, s.shipment_id)
        AND i.lwin IS NOT NULL
        AND split_part(i.lwin, '-', 1) || '-' || split_part(i.lwin, '-', 2) || '-' || split_part(i.lwin, '-', 4)
          = split_part(COALESCE(m.lwin18, s.lwin18), '-', 1) || '-' || split_part(COALESCE(m.lwin18, s.lwin18), '-', 2) || '-' || split_part(COALESCE(m.lwin18, s.lwin18), '-', 4)
      ORDER BY i.created_at DESC
      LIMIT 1
    ) ship ON true
    ${
      hasLotCosts
        ? client`
          LEFT JOIN wms_lot_costs lc
            ON lc.owner_id = COALESCE(m.from_owner_id, s.owner_id)
           AND lc.lot_number = COALESCE(m.lot_number, s.lot_number)
           AND lc.pak_key = split_part(COALESCE(m.lwin18, s.lwin18), '-', 1) || '-' || split_part(COALESCE(m.lwin18, s.lwin18), '-', 2) || '-' || split_part(COALESCE(m.lwin18, s.lwin18), '-', 4)`
        : client``
    }
    WHERE m.movement_type = 'pick'
      AND COALESCE(m.from_owner_id, s.owner_id) = ${partnerId}
      AND so.invoice_number IN (SELECT jsonb_array_elements_text(${refs}::jsonb))
    GROUP BY 1, 2, 3
  `;

  const totals = new Map<string, { value: number; bottles: number; lots: Set<string> }>();

  for (const lot of picked) {
    if (!lot.lwin18 || lot.bottles <= 0) continue;

    const key = wineKey(lot.lwin18);
    const wine = wineCosts.get(key);
    const importCost = lot.lotImport ?? lot.shipmentImport ?? wine?.importPerBottle ?? null;

    /* Nothing to cost the lot from: leave the line on the wine's own figure */
    if (importCost === null) continue;

    const perBottle =
      importCost +
      (lot.lotLogistics ?? wine?.logisticsPerBottle ?? 0) +
      (lot.lotOverride ?? wine?.overridePerBottle ?? 0);
    const line = `${lot.docRef}|${key}`;
    const total = totals.get(line) ?? { value: 0, bottles: 0, lots: new Set<string>() };

    total.value += perBottle * lot.bottles;
    total.bottles += lot.bottles;
    total.lots.add(lot.shipmentNumber ?? lot.lotNumber ?? 'lot');
    totals.set(line, total);
  }

  for (const [line, total] of totals) {
    result.set(line, {
      perBottle: total.value / total.bottles,
      bottles: total.bottles,
      from: `Lot ${[...total.lots].join(', ')}`,
    });
  }

  return result;
};

export default getLotPayoutCosts;
