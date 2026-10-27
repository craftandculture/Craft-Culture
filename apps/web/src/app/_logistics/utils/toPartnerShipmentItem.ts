import type { logisticsShipmentItems } from '@/database/schema';

/**
 * A shipment line as a partner may see it
 *
 * Built from an allowlist, so a column added later stays private until it is
 * deliberately added here. Costs, allocations, margins, target prices and
 * staff notes are never included.
 *
 * @param item - The full line
 * @returns The fields a partner may see
 */
const toPartnerShipmentItem = (item: typeof logisticsShipmentItems.$inferSelect) => ({
  id: item.id,
  shipmentId: item.shipmentId,
  productName: item.productName,
  lwin: item.lwin,
  supplierSku: item.supplierSku,
  producer: item.producer,
  vintage: item.vintage,
  region: item.region,
  countryOfOrigin: item.countryOfOrigin,
  cases: item.cases,
  bottlesPerCase: item.bottlesPerCase,
  bottleSizeMl: item.bottleSizeMl,
  totalBottles: item.totalBottles,
  grossWeightKg: item.grossWeightKg,
  netWeightKg: item.netWeightKg,
  sortOrder: item.sortOrder,
});

export default toPartnerShipmentItem;
