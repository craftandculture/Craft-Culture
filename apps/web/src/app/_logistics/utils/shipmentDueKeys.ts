/** The timing tiles that filter the shipments list, in the order shown (no_news has its own filter) */
export const SHIPMENT_DUE_KEYS = ['late', 'ships_7d', 'arrives_7d'] as const;

export type ShipmentDue = (typeof SHIPMENT_DUE_KEYS)[number];
