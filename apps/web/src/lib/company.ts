/**
 * Our own postal details, for documents that leave the building.
 *
 * Held here rather than beside each template because the same address sits on
 * both delivery notes — the outbound one to distributors and the inbound one
 * confirming a supplier's consignment landed. Two copies drift, and an address
 * that disagrees with itself across two documents is the kind of thing a
 * customs officer notices.
 */
export const COMPANY_NAME = 'Craft & Culture FZE';

/** The bonded warehouse goods are received into. */
export const WAREHOUSE_ADDRESS = {
  name: 'RAK Port',
  lines: ['Warehouse 1.2 (Duty Free)', 'RAK Port', 'Ras Al Khaimah'],
  country: 'United Arab Emirates',
} as const;

/**
 * Address block for a shipment's destination.
 *
 * A shipment can be routed somewhere other than our own warehouse, and the
 * shipment carries that name. Only expand to the full address when the
 * destination is ours — inventing street lines for someone else's site would
 * be worse than printing the bare name we were given.
 *
 * @example
 *   deliveryAddressFor('RAK Port'); // full warehouse block
 *   deliveryAddressFor('Jebel Ali'); // just the name and country
 *
 * @param destinationWarehouse - The shipment's destination warehouse name
 * @returns Name, address lines and country for the document
 */
export const deliveryAddressFor = (destinationWarehouse?: string | null) => {
  const isOurs =
    !destinationWarehouse ||
    destinationWarehouse.trim().toLowerCase() === WAREHOUSE_ADDRESS.name.toLowerCase();

  if (isOurs) {
    return {
      name: COMPANY_NAME,
      lines: [...WAREHOUSE_ADDRESS.lines],
      country: WAREHOUSE_ADDRESS.country,
    };
  }

  return {
    name: destinationWarehouse,
    lines: [] as string[],
    country: WAREHOUSE_ADDRESS.country,
  };
};
