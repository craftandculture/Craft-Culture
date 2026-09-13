/**
 * What an account is, and what it may do
 *
 * Access used to be decided by combinations of two overlapping taxonomies —
 * `users.customerType` and `partners.type` — written out inline at twenty-seven
 * call sites in five slightly different forms. Adding a fifth kind of account
 * meant finding every one of them, and missing one produced a link that leads
 * somewhere the API then refuses.
 *
 * Everything now derives from one resolver and one table. A new kind of account
 * is an entry here and a line in `resolveAccessProfile` — not a search across
 * the codebase.
 */

/** Partner types whose wine physically sits in our warehouse */
export const STOCK_OWNER_PARTNER_TYPES = [
  'wine_partner',
  'private_collector',
] as const;

export type StockOwnerPartnerType = (typeof STOCK_OWNER_PARTNER_TYPES)[number];

/**
 * Whether a partner type is one that holds wine with us
 *
 * @param type - A partner type from the database, or nothing
 * @returns True for wine partners and private collectors
 */
export const isStockOwnerPartnerType = (
  type: string | null | undefined,
): type is StockOwnerPartnerType =>
  STOCK_OWNER_PARTNER_TYPES.includes(type as StockOwnerPartnerType);

export type AccountKind =
  | 'admin'
  | 'warehouse'
  | 'wine_partner'
  | 'collector'
  | 'distributor'
  | 'sales';

export interface AccessCapabilities {
  /** Holds wine with us, so has an inventory screen of their own */
  ownsStock: boolean;
  /** Raises quotes through the pricing tools */
  raiseQuotes: boolean;
  /** Reaches the sourcing and RFQ screens */
  sourceWine: boolean;
  /** Manages orders on behalf of private clients */
  privateOrders: boolean;
  /** Sees the distributor fulfilment screens */
  distributorTools: boolean;
  /** Full administrative access */
  administers: boolean;
}

export interface AccessProfile {
  kind: AccountKind;
  /** What this account's inventory is called, where it has one */
  inventoryLabel: string;
  /** Where this account lands after signing in */
  home: string;
  can: AccessCapabilities;
}

const none: AccessCapabilities = {
  ownsStock: false,
  raiseQuotes: false,
  sourceWine: false,
  privateOrders: false,
  distributorTools: false,
  administers: false,
};

export const ACCESS_PROFILES: Record<AccountKind, AccessProfile> = {
  admin: {
    kind: 'admin',
    inventoryLabel: 'Stock',
    home: '/platform/admin/home',
    can: { ...none, administers: true },
  },
  warehouse: {
    kind: 'warehouse',
    inventoryLabel: 'Stock',
    home: '/platform/admin/wms',
    can: { ...none },
  },
  wine_partner: {
    kind: 'wine_partner',
    inventoryLabel: 'Local Stock',
    home: '/platform/partner/stock',
    can: { ...none, ownsStock: true, sourceWine: true, privateOrders: true },
  },
  collector: {
    kind: 'collector',
    inventoryLabel: 'Your Cellar',
    home: '/platform/partner/stock',
    // A collector owns wine and looks at it. Nothing else, by design.
    can: { ...none, ownsStock: true },
  },
  distributor: {
    kind: 'distributor',
    inventoryLabel: 'Stock',
    home: '/platform/quotes',
    can: { ...none, raiseQuotes: true, distributorTools: true },
  },
  sales: {
    kind: 'sales',
    inventoryLabel: 'Stock',
    home: '/platform/quotes',
    can: { ...none, raiseQuotes: true },
  },
};

export interface AccountShape {
  role?: string | null;
  customerType?: string | null;
  partnerType?: string | null;
}

/**
 * Decide which profile an account has
 *
 * Order matters: a staff role outranks any partner link, and a partner link
 * outranks the customer type it was inferred from.
 *
 * @example
 *   const profile = resolveAccessProfile({
 *     role: 'user',
 *     customerType: 'private_clients',
 *     partnerType: 'private_collector',
 *   }); // → ACCESS_PROFILES.collector
 *
 * @param account - The signed-in user's role, customer type and linked partner type
 * @returns The profile governing their navigation, landing page and capabilities
 */
export const resolveAccessProfile = ({
  role,
  customerType,
  partnerType,
}: AccountShape): AccessProfile => {
  if (role === 'admin') return ACCESS_PROFILES.admin;
  if (role === 'wms_operator') return ACCESS_PROFILES.warehouse;

  if (partnerType === 'wine_partner') return ACCESS_PROFILES.wine_partner;
  if (partnerType === 'private_collector') return ACCESS_PROFILES.collector;
  if (partnerType === 'distributor' || customerType === 'b2b') {
    return ACCESS_PROFILES.distributor;
  }

  return ACCESS_PROFILES.sales;
};

export default resolveAccessProfile;
