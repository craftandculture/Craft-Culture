import type { logisticsShipments } from '@/database/schema';

/**
 * A shipment header as a partner may see it, with totals from their own lines
 *
 * Built from an allowlist: costs, landed cost, client price, margin, FX,
 * forwarder references and internal notes are never included. Totals are
 * summed from the lines the partner owns, so a shared shipment does not
 * reveal how much other owners have on it.
 *
 * @param shipment - The full shipment row
 * @param items - The partner's own lines on it
 * @returns The fields a partner may see
 */
const toPartnerShipment = (
  shipment: typeof logisticsShipments.$inferSelect,
  items: { cases: number | null; totalBottles: number | null; grossWeightKg: number | null }[],
) => ({
  id: shipment.id,
  shipmentNumber: shipment.shipmentNumber,
  type: shipment.type,
  transportMode: shipment.transportMode,
  status: shipment.status,
  originCountry: shipment.originCountry,
  originCity: shipment.originCity,
  destinationCountry: shipment.destinationCountry,
  destinationCity: shipment.destinationCity,
  destinationWarehouse: shipment.destinationWarehouse,
  carrierName: shipment.carrierName,
  containerNumber: shipment.containerNumber,
  blNumber: shipment.blNumber,
  awbNumber: shipment.awbNumber,
  etd: shipment.etd,
  atd: shipment.atd,
  eta: shipment.eta,
  ata: shipment.ata,
  deliveredAt: shipment.deliveredAt,
  partnerNotes: shipment.partnerNotes,
  createdAt: shipment.createdAt,
  updatedAt: shipment.updatedAt,
  totalCases: items.reduce((sum, item) => sum + (item.cases ?? 0), 0),
  totalBottles: items.reduce((sum, item) => sum + (item.totalBottles ?? 0), 0),
  totalWeightKg: items.reduce((sum, item) => sum + (item.grossWeightKg ?? 0), 0),
});

export default toPartnerShipment;
