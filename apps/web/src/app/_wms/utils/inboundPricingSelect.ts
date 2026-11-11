import { sql } from 'drizzle-orm';

import {
  logisticsShipmentItems,
  partners,
  wmsOwnerPricingSettings,
  wmsProductPricing,
} from '@/database/schema';

/**
 * Everything a price is built from, for one in-transit line: one wine, pack
 * and size on one shipment. The in-transit counterpart of stockPricingSelect,
 * selected by both the Pricing Manager and the in-transit price list.
 *
 * Use in a query over `logistics_shipment_items` joined to its shipment, the
 * shipment's partner (`partners`), `wms_owner_pricing_settings` on that partner
 * and `wms_product_pricing` pack-agnostically, grouped by shipment as well as
 * wine, pack and size. Turn the result into a price with `inboundPricingInput`.
 */
const inboundPricingSelect = {
  /* A manually corrected import price wins over the shipment's own figure */
  importPricePerBottle: sql<
    number | null
  >`COALESCE(NULLIF(MAX(${wmsProductPricing.importPricePerBottle}), 0), MAX(${logisticsShipmentItems.productCostPerBottle}))`,
  sellingPricePerBottle: sql<
    number | null
  >`MAX(${wmsProductPricing.sellingPricePerBottle})`,
  costOverridePerBottle: sql<
    number | null
  >`MAX(${wmsProductPricing.costOverridePerBottle})`,
  lineLogistics: sql<
    number | null
  >`MAX(${wmsProductPricing.logisticsPerBottle})`,
  transferPricePerBottle: sql<
    number | null
  >`MAX(${wmsProductPricing.transferPricePerBottle})`,
  sellMarginPct: sql<number | null>`MAX(${wmsProductPricing.sellMarginPct})`,
  b2bMarginPct: sql<number | null>`MAX(${wmsProductPricing.b2bMarginPct})`,
  pcMarginPct: sql<number | null>`MAX(${wmsProductPricing.pcMarginPct})`,
  /*
    Freight actually allocated to the shipment line, per bottle. Zero until the
    freight invoice is loaded against the consolidation group.
  */
  allocatedFreight: sql<
    number | null
  >`MAX(GREATEST(COALESCE(${logisticsShipmentItems.landedCostPerBottle}, 0) - COALESCE(${logisticsShipmentItems.productCostPerBottle}, 0), 0))`,
  /*
    Cru Wine / Crurated transfer at $0 in transit as they do once landed. The
    Pricing Manager's in-transit rows never carried this, so they charged
    those owners $2.50 the price list did not.
  */
  isZeroTransferOwner: sql<number>`MAX(CASE WHEN ${partners.businessName} ILIKE '%cru wine%' OR ${partners.businessName} ILIKE '%crurated%' THEN 1 ELSE 0 END)::int`,
  ownerLogistics: sql<
    number | null
  >`MAX(${wmsOwnerPricingSettings.logisticsPerBottle})`,
  ownerInbondPct: sql<
    number | null
  >`MAX(${wmsOwnerPricingSettings.inbondMarginPct})`,
  ownerPcPct: sql<number | null>`MAX(${wmsOwnerPricingSettings.pcMarginPct})`,
  category: sql<
    string | null
  >`MAX(CASE WHEN ${logisticsShipmentItems.hsCode} IN ('22042100','22041000') THEN 'Wine' WHEN ${logisticsShipmentItems.hsCode} IN ('22084000','22083000','22082000','22089090','22085000','22087000','22086000') THEN 'Spirits' WHEN ${logisticsShipmentItems.hsCode} IN ('22030000','22060000') THEN 'RTD' ELSE NULL END)`,
};

export default inboundPricingSelect;
