import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * @deprecated Legacy cell mapping type - kept for backwards compatibility with existing data
 */
interface LegacyCellMapping {
  [key: string]: { row: number; col: number };
}

export const timestamps = {
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const productSource = pgEnum('product_source', ['cultx', 'local_inventory']);

export const customerType = pgEnum('user_type', ['b2b', 'b2c', 'private_clients']);

export const userRole = pgEnum('user_role', ['user', 'admin']);

export const approvalStatus = pgEnum('approval_status', [
  'pending',
  'approved',
  'rejected',
]);

export const quoteStatus = pgEnum('quote_status', [
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'buy_request_submitted',
  'under_cc_review',
  'revision_requested',
  'cc_confirmed',
  'awaiting_payment',
  'paid',
  'po_submitted',
  'po_confirmed',
  'delivered',
]);

export const paymentMethod = pgEnum('payment_method', ['bank_transfer', 'link']);

/**
 * @deprecated Legacy sheets table - kept for data preservation, no longer actively used
 */
export const sheets = pgTable('sheets', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  googleSheetId: text('google_sheet_id').notNull().unique(),
  formulaData: jsonb('formula_data').notNull(),
  ...timestamps,
}).enableRLS();

/**
 * @deprecated Legacy pricing models table - kept for data preservation, no longer actively used
 */
export const pricingModels = pgTable(
  'pricing_models',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    isDefaultB2C: boolean('is_default_b2c').notNull().default(false),
    isDefaultB2B: boolean('is_default_b2b').notNull().default(false),
    sheetId: uuid('sheet_id')
      .references(() => sheets.id, { onDelete: 'cascade' })
      .notNull(),
    cellMappings: jsonb('cell_mappings').$type<LegacyCellMapping>().notNull(),
    ...timestamps,
  },
  (table) => [
    // Ensure only one default B2C pricing model
    index('unique_default_b2c')
      .on(table.isDefaultB2C)
      .where(sql`${table.isDefaultB2C} = true`),
    // Ensure only one default B2B pricing model
    index('unique_default_b2b')
      .on(table.isDefaultB2B)
      .where(sql`${table.isDefaultB2B} = true`),
  ],
).enableRLS();

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  role: userRole('role').notNull().default('user'),
  customerType: customerType('customer_type').notNull().default('b2c'),
  isRetailPartner: boolean('is_retail_partner').notNull().default(false),
  isTestUser: boolean('is_test_user').notNull().default(false),
  companyName: text('company_name'),
  companyLogo: text('company_logo'),
  companyAddress: text('company_address'),
  companyPhone: text('company_phone'),
  companyEmail: text('company_email'),
  companyWebsite: text('company_website'),
  companyVatNumber: text('company_vat_number'),
  // Personal address fields (for B2C users)
  addressLine1: text('address_line_1'),
  addressLine2: text('address_line_2'),
  city: text('city'),
  stateProvince: text('state_province'),
  postalCode: text('postal_code'),
  country: text('country'),
  phone: text('phone'),
  // Bank details for commission payouts (B2C users)
  bankDetails: jsonb('bank_details').$type<{
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    sortCode?: string;
    iban?: string;
    swiftBic?: string;
    branchAddress?: string;
  }>(),
  onboardingCompletedAt: timestamp('onboarding_completed_at', {
    mode: 'date',
  }),
  pricingModelId: uuid('pricing_model_id').references(() => pricingModels.id, {
    onDelete: 'set null',
  }),
  approvalStatus: approvalStatus('approval_status').notNull().default('pending'),
  approvedAt: timestamp('approved_at', { mode: 'date' }),
  approvedBy: uuid('approved_by'),
  termsAcceptedAt: timestamp('terms_accepted_at', { mode: 'date' }),
  // Partner ID for wine partner users (private_clients customer type)
  partnerId: uuid('partner_id'),
  // Notification preferences - which notification types user/admin has disabled
  notificationPreferences: jsonb('notification_preferences').$type<{
    disabledTypes?: string[];
    adminDisabledTypes?: string[];
  }>(),

  // Better Auth admin plugin fields
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires', { mode: 'date' }),

  ...timestamps,
});
// Note: No RLS on users - managed by Better Auth

export type User = typeof users.$inferSelect;

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', {
    mode: 'date',
    withTimezone: true,
  }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  /** If set, this session is an impersonation - the admin who started it */
  impersonatedBy: uuid('impersonated_by').references(() => users.id),
  ...timestamps,
});
// Note: No RLS on sessions - managed by Better Auth

export type Session = typeof sessions.$inferSelect;

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', {
    mode: 'date',
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
    mode: 'date',
    withTimezone: true,
  }),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'),
  ...timestamps,
});
// Note: No RLS on accounts - managed by Better Auth

export const verifications = pgTable('verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', {
    mode: 'date',
    withTimezone: true,
  }).notNull(),
  ...timestamps,
});
// Note: No RLS on verifications - managed by Better Auth

export const passkeys = pgTable('passkeys', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  publicKey: text('public_key').notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  credentialID: text('credential_id').notNull(),
  counter: integer('counter').notNull(),
  deviceType: text('device_type').notNull(),
  backedUp: boolean('backed_up').notNull(),
  transports: text('transports').notNull(),
  aaguid: text('aaguid'),
  ...timestamps,
});
// Note: No RLS on passkeys - managed by Better Auth

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lwin18: text('lwin18').notNull().unique(),
    name: text('name').notNull(),
    region: text('region'),
    producer: text('producer'),
    country: text('country'),
    year: integer('year'),
    imageUrl: text('image_url'),
    ...timestamps,
  },
  (table) => [
    index('products_search_idx').using(
      'gin',
      sql`(
        setweight(to_tsvector('english', coalesce(${table.name}, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(${table.producer}, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(${table.lwin18}, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(${table.region}, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(${table.year}::text, '')), 'C')
      )`,
    ),
    index('products_name_trigram_idx').using(
      'gin',
      sql`${table.name} gin_trgm_ops`,
    ),
    index('products_producer_trigram_idx').using(
      'gin',
      sql`${table.producer} gin_trgm_ops`,
    ),
    index('products_lwin_trigram_idx').using(
      'gin',
      sql`${table.lwin18} gin_trgm_ops`,
    ),
  ],
).enableRLS();

export const productOffers = pgTable('product_offers', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  externalId: text('external_id').notNull().unique(),
  source: productSource('source').notNull(),
  price: doublePrecision('price').notNull().default(0),
  currency: text('currency').notNull(),
  unitCount: integer('unit_count').notNull(),
  unitSize: text('unit_size').notNull(),
  availableQuantity: integer('available_quantity').notNull(),
  ...timestamps,
}).enableRLS();

export const adminActivityLogs = pgTable(
  'admin_activity_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminId: uuid('admin_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    metadata: jsonb('metadata'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    ...timestamps,
  },
  (table) => [
    index('admin_activity_logs_admin_id_idx').on(table.adminId),
    index('admin_activity_logs_created_at_idx').on(table.createdAt),
    index('admin_activity_logs_action_idx').on(table.action),
  ],
).enableRLS();

export const userActivityLogs = pgTable(
  'user_activity_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    metadata: jsonb('metadata'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    ...timestamps,
  },
  (table) => [
    index('user_activity_logs_user_id_idx').on(table.userId),
    index('user_activity_logs_created_at_idx').on(table.createdAt),
    index('user_activity_logs_action_idx').on(table.action),
  ],
).enableRLS();

export const warehouseSensorReadings = pgTable(
  'warehouse_sensor_readings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sensorId: text('sensor_id').notNull(),
    sensorType: text('sensor_type').notNull(),
    value: doublePrecision('value').notNull(),
    unit: text('unit').notNull(),
    location: text('location'),
    timestamp: timestamp('timestamp', { mode: 'date' }).notNull().defaultNow(),
    metadata: jsonb('metadata'),
  },
  (table) => [
    index('warehouse_sensor_readings_sensor_id_idx').on(table.sensorId),
    index('warehouse_sensor_readings_timestamp_idx').on(table.timestamp),
    index('warehouse_sensor_readings_sensor_type_idx').on(table.sensorType),
  ],
).enableRLS();

export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  ...timestamps,
}).enableRLS();

export type Settings = typeof settings.$inferSelect;

// Partner management enums
export const partnerType = pgEnum('partner_type', [
  'retailer',
  'sommelier',
  'distributor',
  'wine_partner',
  'supplier',
]);

export const partnerStatus = pgEnum('partner_status', [
  'active',
  'inactive',
  'suspended',
]);

// Partner profiles for retail partners, sommeliers, distributors
export const partners = pgTable(
  'partners',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Optional: only used if partner has a platform account (e.g., for API access)
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    type: partnerType('type').notNull(),
    status: partnerStatus('status').notNull().default('active'),
    businessName: text('business_name').notNull(),
    businessAddress: text('business_address'),
    businessPhone: text('business_phone'),
    businessEmail: text('business_email'),
    taxId: text('tax_id'),
    commissionRate: doublePrecision('commission_rate').notNull().default(0),
    notes: text('notes'),
    metadata: jsonb('metadata'),
    // Partner branding
    logoUrl: text('logo_url'),
    brandColor: text('brand_color'),
    // Distributor-specific: requires client verification before order proceeds
    requiresClientVerification: boolean('requires_client_verification')
      .notNull()
      .default(false),
    // Distributor code for payment references (e.g., 'CD', 'TBS')
    distributorCode: text('distributor_code'),
    // Finance department email for proforma invoices (distributors only)
    financeEmail: text('finance_email'),
    // Private client pricing configuration
    marginPercentage: doublePrecision('margin_percentage').default(40.6),
    logisticsCostPerCase: doublePrecision('logistics_cost_per_case').default(60),
    pcoDutyRate: doublePrecision('pco_duty_rate').default(0.05),
    pcoVatRate: doublePrecision('pco_vat_rate').default(0.05),
    currencyPreference: text('currency_preference').default('USD'),
    // Payment configuration for licensed partners
    paymentMethod: paymentMethod('payment_method'),
    paymentDetails: jsonb('payment_details').$type<{
      // Bank transfer details
      bankName?: string;
      accountName?: string;
      accountNumber?: string;
      sortCode?: string;
      iban?: string;
      swiftBic?: string;
      reference?: string;
      // Payment link
      paymentUrl?: string;
    }>(),
    // Zoho Books integration
    zohoContactId: text('zoho_contact_id'),
    zohoVendorId: text('zoho_vendor_id'),
    zohoLastSyncAt: timestamp('zoho_last_sync_at', { mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    index('partners_user_id_idx').on(table.userId),
    index('partners_type_idx').on(table.type),
    index('partners_status_idx').on(table.status),
  ],
).enableRLS();

export type Partner = typeof partners.$inferSelect;

/**
 * Partner member roles for access control
 */
export const partnerMemberRole = pgEnum('partner_member_role', [
  'owner',
  'member',
  'viewer',
]);

/**
 * Partner members - links users to partners (distributors, retailers, etc.)
 * Enables multiple staff members to access a partner's data
 */
export const partnerMembers = pgTable(
  'partner_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    partnerId: uuid('partner_id')
      .references(() => partners.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: partnerMemberRole('role').notNull().default('member'),
    addedBy: uuid('added_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (table) => [
    index('partner_members_partner_id_idx').on(table.partnerId),
    index('partner_members_user_id_idx').on(table.userId),
  ],
).enableRLS();

export type PartnerMember = typeof partnerMembers.$inferSelect;

/**
 * Partner contacts - named contacts at a partner company for RFQ notifications
 * Allows sending RFQs to specific people instead of the company's general email
 */
export const partnerContacts = pgTable(
  'partner_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    partnerId: uuid('partner_id')
      .references(() => partners.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    role: text('role'), // e.g., "Buyer", "Operations Manager"
    phone: text('phone'),
    isPrimary: boolean('is_primary').notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index('partner_contacts_partner_id_idx').on(table.partnerId),
    index('partner_contacts_email_idx').on(table.email),
  ],
).enableRLS();

export type PartnerContact = typeof partnerContacts.$inferSelect;

export const quotes = pgTable(
  'quotes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    status: quoteStatus('status').notNull().default('draft'),
    lineItems: jsonb('line_items').notNull(),
    quoteData: jsonb('quote_data').notNull(),
    clientName: text('client_name'),
    clientEmail: text('client_email'),
    clientCompany: text('client_company'),
    notes: text('notes'),
    currency: text('currency').notNull().default('USD'),
    totalUsd: doublePrecision('total_usd').notNull(),
    totalAed: doublePrecision('total_aed'),
    expiresAt: timestamp('expires_at', { mode: 'date' }),
    acceptedAt: timestamp('accepted_at', { mode: 'date' }),
    acceptanceNotes: text('acceptance_notes'),
    acceptedBy: uuid('accepted_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    // Buy request tracking
    buyRequestSubmittedAt: timestamp('buy_request_submitted_at', {
      mode: 'date',
    }),
    buyRequestSubmittedBy: uuid('buy_request_submitted_by').references(
      () => users.id,
      { onDelete: 'set null' },
    ),
    buyRequestCount: integer('buy_request_count').notNull().default(0),
    // C&C review tracking
    ccReviewStartedAt: timestamp('cc_review_started_at', { mode: 'date' }),
    ccReviewedBy: uuid('cc_reviewed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    ccNotes: text('cc_notes'),
    // Revision tracking
    revisionRequestedAt: timestamp('revision_requested_at', { mode: 'date' }),
    revisionRequestedBy: uuid('revision_requested_by').references(
      () => users.id,
      { onDelete: 'set null' },
    ),
    revisionReason: text('revision_reason'),
    revisionSuggestions: jsonb('revision_suggestions'),
    revisionHistory: jsonb('revision_history'),
    // C&C confirmation
    ccConfirmedAt: timestamp('cc_confirmed_at', { mode: 'date' }),
    ccConfirmedBy: uuid('cc_confirmed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    ccConfirmationNotes: text('cc_confirmation_notes'),
    // PO tracking
    poNumber: text('po_number'),
    poSubmittedAt: timestamp('po_submitted_at', { mode: 'date' }),
    poSubmittedBy: uuid('po_submitted_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    poAttachmentUrl: text('po_attachment_url'),
    deliveryLeadTime: text('delivery_lead_time'),
    // PO confirmation
    poConfirmedAt: timestamp('po_confirmed_at', { mode: 'date' }),
    poConfirmedBy: uuid('po_confirmed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    poConfirmationNotes: text('po_confirmation_notes'),
    // Licensed partner payment
    licensedPartnerId: uuid('licensed_partner_id').references(() => partners.id, {
      onDelete: 'set null',
    }),
    paymentMethod: paymentMethod('payment_method'),
    paymentDetails: jsonb('payment_details').$type<{
      // Bank transfer details
      bankName?: string;
      accountName?: string;
      accountNumber?: string;
      sortCode?: string;
      iban?: string;
      swiftBic?: string;
      reference?: string;
      // Payment link
      paymentUrl?: string;
    }>(),
    paymentProofUrl: text('payment_proof_url'),
    paymentProofSubmittedAt: timestamp('payment_proof_submitted_at', { mode: 'date' }),
    paidAt: timestamp('paid_at', { mode: 'date' }),
    paidConfirmedBy: uuid('paid_confirmed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    deliveredAt: timestamp('delivered_at', { mode: 'date' }),
    deliveredConfirmedBy: uuid('delivered_confirmed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    // Commission payout tracking (for B2C users)
    commissionPaidOutAt: timestamp('commission_paid_out_at', { mode: 'date' }),
    commissionPaidOutBy: uuid('commission_paid_out_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    commissionPayoutReference: text('commission_payout_reference'),
    commissionPayoutNotes: text('commission_payout_notes'),
    ...timestamps,
  },
  (table) => [
    index('quotes_user_id_idx').on(table.userId),
    index('quotes_created_at_idx').on(table.createdAt),
    index('quotes_status_idx').on(table.status),
  ],
).enableRLS();

export type Quote = typeof quotes.$inferSelect;

// API keys for partner integrations (POS systems, etc.)
export const partnerApiKeys = pgTable(
  'partner_api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    partnerId: uuid('partner_id')
      .references(() => partners.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    keyPrefix: text('key_prefix').notNull(),
    keyHash: text('key_hash').notNull(),
    lastUsedAt: timestamp('last_used_at', { mode: 'date' }),
    expiresAt: timestamp('expires_at', { mode: 'date' }),
    isRevoked: boolean('is_revoked').notNull().default(false),
    revokedAt: timestamp('revoked_at', { mode: 'date' }),
    revokedBy: uuid('revoked_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    permissions: jsonb('permissions').$type<string[]>().notNull().default([]),
    ...timestamps,
  },
  (table) => [
    index('partner_api_keys_partner_id_idx').on(table.partnerId),
    index('partner_api_keys_key_prefix_idx').on(table.keyPrefix),
    index('partner_api_keys_is_revoked_idx').on(table.isRevoked),
  ],
).enableRLS();

export type PartnerApiKey = typeof partnerApiKeys.$inferSelect;

// API request logs for audit and analytics
export const partnerApiRequestLogs = pgTable(
  'partner_api_request_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    apiKeyId: uuid('api_key_id').references(() => partnerApiKeys.id, {
      onDelete: 'set null',
    }),
    partnerId: uuid('partner_id').references(() => partners.id, {
      onDelete: 'set null',
    }),
    endpoint: text('endpoint').notNull(),
    method: text('method').notNull(),
    statusCode: integer('status_code').notNull(),
    responseTimeMs: integer('response_time_ms'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    errorMessage: text('error_message'),
    ...timestamps,
  },
  (table) => [
    index('partner_api_request_logs_api_key_id_idx').on(table.apiKeyId),
    index('partner_api_request_logs_partner_id_idx').on(table.partnerId),
    index('partner_api_request_logs_created_at_idx').on(table.createdAt),
    index('partner_api_request_logs_endpoint_idx').on(table.endpoint),
    // Composite index for rate limiting queries
    index('partner_api_request_logs_rate_limit_idx').on(
      table.apiKeyId,
      table.createdAt,
    ),
  ],
).enableRLS();

// ============================================================================
// Notifications
// ============================================================================

export const notificationType = pgEnum('notification_type', [
  'new_user_pending',
  'buy_request_submitted',
  'cc_review_started',
  'quote_confirmed',
  'revision_requested',
  'po_submitted',
  'po_confirmed',
  'po_approved',
  'payment_received',
  'payment_proof_submitted',
  'order_delivered',
  'action_required',
  'po_assigned',
  'status_update',
  // SOURCE RFQ notifications
  'rfq_received',
  'rfq_response_submitted',
  'rfq_deadline_reminder',
  'rfq_quotes_selected',
  // SOURCE PO notifications
  'po_received',
  // SOURCE Supplier Order notifications
  'supplier_order_received',
  'supplier_order_confirmed',
  'supplier_order_updated',
  'supplier_order_rejected',
  'supplier_order_reminder',
  // SOURCE Customer PO notifications (for distributors)
  'customer_po_received',
  'customer_po_orders_generated',
  'customer_po_ready',
  // Logistics notifications
  'shipment_status_changed',
  'document_expired',
  'document_expiring_soon',
]);

/**
 * In-app notifications for users
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    partnerId: uuid('partner_id').references(() => partners.id, {
      onDelete: 'cascade',
    }),
    type: notificationType('type').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    entityType: text('entity_type'), // e.g., 'quote'
    entityId: uuid('entity_id'), // e.g., quote ID
    actionUrl: text('action_url'), // URL to navigate to when clicked
    isRead: boolean('is_read').notNull().default(false),
    readAt: timestamp('read_at', { mode: 'date' }),
    metadata: jsonb('metadata'), // Additional data as needed
    ...timestamps,
  },
  (table) => [
    index('notifications_user_id_idx').on(table.userId),
    index('notifications_user_id_is_read_idx').on(table.userId, table.isRead),
    index('notifications_created_at_idx').on(table.createdAt),
    index('notifications_partner_id_idx').on(table.partnerId),
  ],
).enableRLS();

export type Notification = typeof notifications.$inferSelect;

// ============================================================================
// Pricing Calculator
// ============================================================================

export const pricingSessionStatus = pgEnum('pricing_session_status', [
  'draft',
  'mapped',
  'calculated',
  'exported',
]);

/**
 * LWIN reference database for wine identification
 * Used for optional product lookup and enrichment in pricing calculator
 */
export const lwinReference = pgTable(
  'lwin_reference',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lwin: text('lwin').notNull().unique(),
    displayName: text('display_name'),
    producerTitle: text('producer_title'),
    producerName: text('producer_name'),
    wine: text('wine'),
    country: text('country'),
    region: text('region'),
    subRegion: text('sub_region'),
    colour: text('colour'),
    type: text('type'),
    subType: text('sub_type'),
    vintageConfig: text('vintage_config'),
    ...timestamps,
  },
  (table) => [
    index('lwin_reference_lwin_idx').on(table.lwin),
    index('lwin_reference_display_name_trigram_idx').using(
      'gin',
      sql`${table.displayName} gin_trgm_ops`,
    ),
    index('lwin_reference_wine_trigram_idx').using(
      'gin',
      sql`${table.wine} gin_trgm_ops`,
    ),
    index('lwin_reference_producer_trigram_idx').using(
      'gin',
      sql`${table.producerName} gin_trgm_ops`,
    ),
  ],
).enableRLS();

export type LwinReference = typeof lwinReference.$inferSelect;

/**
 * Pricing calculator sessions
 * Each session represents a supplier sheet being processed
 */
export const pricingSessions = pgTable(
  'pricing_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    status: pricingSessionStatus('status').notNull().default('draft'),

    // Source
    sourceType: text('source_type').notNull(), // 'upload' | 'google_sheet'
    sourceFileName: text('source_file_name'),
    googleSheetId: text('google_sheet_id'),
    rawData: jsonb('raw_data'), // Original parsed rows
    detectedColumns: jsonb('detected_columns'), // Column headers found

    // Column mapping
    columnMapping: jsonb('column_mapping'),

    // Configuration
    calculationVariables: jsonb('calculation_variables').$type<{
      // Currency
      inputCurrency: 'GBP' | 'EUR' | 'USD';
      gbpToUsdRate: number;
      eurToUsdRate: number;
      usdToAedRate: number;

      // Default case config
      defaultCaseConfig?: number;

      // Margin (applied BEFORE freight)
      marginType: 'percentage' | 'absolute';
      marginPercent: number;
      marginAbsolute: number;

      // Freight (per bottle - multiplied by case config)
      freightPerBottle?: number;

      // D2C only
      salesAdvisorMarginPercent: number;
      importDutyPercent: number;
      localCosts: number;
      vatPercent: number;
    }>(),

    // Results
    itemCount: integer('item_count').default(0),
    errors: jsonb('errors'),
    warnings: jsonb('warnings'),

    // Audit
    createdBy: uuid('created_by')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    ...timestamps,
  },
  (table) => [
    index('pricing_sessions_created_by_idx').on(table.createdBy),
    index('pricing_sessions_status_idx').on(table.status),
    index('pricing_sessions_created_at_idx').on(table.createdAt),
  ],
).enableRLS();

export type PricingSession = typeof pricingSessions.$inferSelect;

/**
 * Individual pricing items within a session
 * Each row represents a wine product being priced
 */
export const pricingItems = pgTable(
  'pricing_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .references(() => pricingSessions.id, { onDelete: 'cascade' })
      .notNull(),

    // Product identification (LWIN optional)
    lwin: text('lwin'),
    productName: text('product_name').notNull(),
    vintage: text('vintage'),
    region: text('region'),
    producer: text('producer'),
    bottleSize: text('bottle_size'),
    caseConfig: integer('case_config'),

    // Input pricing
    ukInBondPrice: doublePrecision('uk_in_bond_price').notNull(),
    inputCurrency: text('input_currency').notNull(), // GBP, EUR, USD

    // B2B Calculated pricing (In-Bond UAE)
    inBondCaseUsd: doublePrecision('in_bond_case_usd'),
    inBondBottleUsd: doublePrecision('in_bond_bottle_usd'),
    inBondCaseAed: doublePrecision('in_bond_case_aed'),
    inBondBottleAed: doublePrecision('in_bond_bottle_aed'),

    // D2C Calculated pricing (Delivered)
    deliveredCaseUsd: doublePrecision('delivered_case_usd'),
    deliveredBottleUsd: doublePrecision('delivered_bottle_usd'),
    deliveredCaseAed: doublePrecision('delivered_case_aed'),
    deliveredBottleAed: doublePrecision('delivered_bottle_aed'),

    // Wine-Searcher market data (optional)
    wsAvgPrice: doublePrecision('ws_avg_price'),
    wsMinPrice: doublePrecision('ws_min_price'),
    wsMaxPrice: doublePrecision('ws_max_price'),
    wsMerchantCount: integer('ws_merchant_count'),
    wsCriticScore: integer('ws_critic_score'),
    wsLink: text('ws_link'),
    wsFetchedAt: timestamp('ws_fetched_at', { mode: 'date' }),

    // Status
    hasWarning: boolean('has_warning').default(false),
    warningMessage: text('warning_message'),

    ...timestamps,
  },
  (table) => [
    index('pricing_items_session_id_idx').on(table.sessionId),
    index('pricing_items_lwin_idx').on(table.lwin),
  ],
).enableRLS();

export type PricingItem = typeof pricingItems.$inferSelect;

// ============================================================================
// Private Client Orders
// ============================================================================

export const privateClientOrderStatus = pgEnum('private_client_order_status', [
  'draft',
  'submitted',
  'under_cc_review',
  'revision_requested',
  'cc_approved',
  // Verification flow (only for distributors that require it, e.g., City Drinks)
  'awaiting_partner_verification', // Partner confirms client is verified with distributor
  'awaiting_distributor_verification', // Distributor verifies client in their system
  'verification_suspended', // Verification failed - partner needs to resolve
  // Payment flow
  'awaiting_client_payment', // Distributor collecting payment from client
  'awaiting_payment_verification', // Partner confirmed payment, awaiting distributor verification
  'client_paid', // Client paid, distributor raises PO to C&C
  'awaiting_distributor_payment',
  'distributor_paid',
  'awaiting_partner_payment',
  'partner_paid',
  // Delivery scheduling flow
  'scheduling_delivery', // Distributor is trying to contact client
  'delivery_scheduled', // Delivery date confirmed with client
  // Fulfillment flow
  'stock_in_transit',
  'with_distributor',
  'out_for_delivery',
  'delivered',
  'cancelled',
]);

export const orderItemSource = pgEnum('order_item_source', [
  'partner_local',
  'partner_airfreight',
  'cc_inventory',
  'manual',
]);

export const orderItemStockStatus = pgEnum('order_item_stock_status', [
  'pending',
  'confirmed',
  'in_transit_to_cc',
  'at_cc_bonded',
  'at_cc_ready_for_dispatch',
  'in_transit_to_distributor',
  'at_distributor',
  'delivered',
]);

export const privateClientDocumentType = pgEnum('private_client_document_type', [
  'partner_invoice',
  'cc_invoice',
  'distributor_invoice',
  'payment_proof',
  'proof_of_delivery',
]);

export const documentExtractionStatus = pgEnum('document_extraction_status', [
  'pending',
  'processing',
  'completed',
  'failed',
]);

/**
 * Private client orders - main order record
 */
export const privateClientOrders = pgTable(
  'private_client_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderNumber: text('order_number').notNull().unique(),

    // Partner who created the order (wine partner) - nullable for admin-created orders
    partnerId: uuid('partner_id').references(() => partners.id, {
      onDelete: 'restrict',
    }),

    // Assigned distributor (mainland partner like City Drinks)
    distributorId: uuid('distributor_id').references(() => partners.id, {
      onDelete: 'set null',
    }),

    // Client reference (from privateClientContacts)
    clientId: uuid('client_id'),

    // Client info (denormalized for quick access)
    clientName: text('client_name').notNull(),
    clientEmail: text('client_email'),
    clientPhone: text('client_phone'),
    clientAddress: text('client_address'),
    deliveryNotes: text('delivery_notes'),

    // Order status
    status: privateClientOrderStatus('status').notNull().default('draft'),

    // Pricing (all in USD, with AED conversion)
    subtotalUsd: doublePrecision('subtotal_usd').notNull().default(0),
    dutyUsd: doublePrecision('duty_usd').notNull().default(0),
    vatUsd: doublePrecision('vat_usd').notNull().default(0),
    logisticsUsd: doublePrecision('logistics_usd').notNull().default(0),
    totalUsd: doublePrecision('total_usd').notNull().default(0),
    totalAed: doublePrecision('total_aed'),
    usdToAedRate: doublePrecision('usd_to_aed_rate'),

    // Item counts
    itemCount: integer('item_count').notNull().default(0),
    caseCount: integer('case_count').notNull().default(0),

    // Notes from each party
    partnerNotes: text('partner_notes'),
    ccNotes: text('cc_notes'),
    distributorNotes: text('distributor_notes'),

    // Workflow timestamps
    submittedAt: timestamp('submitted_at', { mode: 'date' }),
    submittedBy: uuid('submitted_by').references(() => users.id, {
      onDelete: 'set null',
    }),

    ccReviewStartedAt: timestamp('cc_review_started_at', { mode: 'date' }),
    ccReviewedBy: uuid('cc_reviewed_by').references(() => users.id, {
      onDelete: 'set null',
    }),

    revisionRequestedAt: timestamp('revision_requested_at', { mode: 'date' }),
    revisionRequestedBy: uuid('revision_requested_by').references(
      () => users.id,
      { onDelete: 'set null' },
    ),
    revisionReason: text('revision_reason'),

    ccApprovedAt: timestamp('cc_approved_at', { mode: 'date' }),
    ccApprovedBy: uuid('cc_approved_by').references(() => users.id, {
      onDelete: 'set null',
    }),

    distributorAssignedAt: timestamp('distributor_assigned_at', { mode: 'date' }),
    distributorAssignedBy: uuid('distributor_assigned_by').references(
      () => users.id,
      { onDelete: 'set null' },
    ),

    // Partner verification step (partner confirms client is verified with distributor)
    partnerVerificationResponse: text('partner_verification_response'), // 'yes', 'no', 'dont_know'
    partnerVerificationAt: timestamp('partner_verification_at', { mode: 'date' }),
    partnerVerificationBy: uuid('partner_verification_by').references(
      () => users.id,
      { onDelete: 'set null' },
    ),

    // Distributor verification step (distributor confirms client in their system)
    distributorVerificationResponse: text('distributor_verification_response'), // 'verified', 'not_verified'
    distributorVerificationAt: timestamp('distributor_verification_at', {
      mode: 'date',
    }),
    distributorVerificationBy: uuid('distributor_verification_by').references(
      () => users.id,
      { onDelete: 'set null' },
    ),
    distributorVerificationNotes: text('distributor_verification_notes'),

    // Invoice workflow - distributor uploads, partner acknowledges
    partnerInvoiceAcknowledgedAt: timestamp('partner_invoice_acknowledged_at', {
      mode: 'date',
    }),
    partnerInvoiceAcknowledgedBy: uuid('partner_invoice_acknowledged_by').references(
      () => users.id,
      { onDelete: 'set null' },
    ),

    // Payment reference for distributor finance (captured when confirming payment)
    paymentReference: text('payment_reference'),

    // Partner can add notes/proof about client payment
    partnerPaymentNotes: text('partner_payment_notes'),
    partnerPaymentProofUrl: text('partner_payment_proof_url'),

    // Legacy client verification fields (kept for backwards compatibility)
    clientVerifiedAt: timestamp('client_verified_at', { mode: 'date' }),
    clientVerifiedBy: uuid('client_verified_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    clientVerificationNotes: text('client_verification_notes'),

    // Payment timestamps
    clientPaidAt: timestamp('client_paid_at', { mode: 'date' }),
    clientPaymentConfirmedBy: uuid('client_payment_confirmed_by').references(
      () => users.id,
      { onDelete: 'set null' },
    ),
    clientPaymentReference: text('client_payment_reference'),

    // Distributor payment verification (after partner confirms client payment)
    distributorPaymentVerifiedAt: timestamp('distributor_payment_verified_at', {
      mode: 'date',
    }),
    distributorPaymentVerifiedBy: uuid(
      'distributor_payment_verified_by',
    ).references(() => users.id, { onDelete: 'set null' }),

    distributorPaidAt: timestamp('distributor_paid_at', { mode: 'date' }),
    distributorPaymentConfirmedBy: uuid(
      'distributor_payment_confirmed_by',
    ).references(() => users.id, { onDelete: 'set null' }),
    distributorPaymentReference: text('distributor_payment_reference'),

    partnerPaidAt: timestamp('partner_paid_at', { mode: 'date' }),
    partnerPaymentConfirmedBy: uuid('partner_payment_confirmed_by').references(
      () => users.id,
      { onDelete: 'set null' },
    ),
    partnerPaymentReference: text('partner_payment_reference'),

    // Stock movement timestamps
    stockReleasedAt: timestamp('stock_released_at', { mode: 'date' }),
    stockReleasedBy: uuid('stock_released_by').references(() => users.id, {
      onDelete: 'set null',
    }),

    stockReceivedAt: timestamp('stock_received_at', { mode: 'date' }),
    stockReceivedBy: uuid('stock_received_by').references(() => users.id, {
      onDelete: 'set null',
    }),

    // Delivery scheduling
    scheduledDeliveryDate: timestamp('scheduled_delivery_date', { mode: 'date' }),
    scheduledDeliveryAt: timestamp('scheduled_delivery_at', { mode: 'date' }),
    scheduledDeliveryBy: uuid('scheduled_delivery_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    deliveryContactAttempts: jsonb('delivery_contact_attempts').$type<
      Array<{
        attemptedAt: string;
        attemptedBy: string;
        notes: string;
      }>
    >(),

    // Delivery timestamps
    outForDeliveryAt: timestamp('out_for_delivery_at', { mode: 'date' }),
    outForDeliveryBy: uuid('out_for_delivery_by').references(() => users.id, {
      onDelete: 'set null',
    }),

    deliveredAt: timestamp('delivered_at', { mode: 'date' }),
    deliveredConfirmedBy: uuid('delivered_confirmed_by').references(
      () => users.id,
      { onDelete: 'set null' },
    ),
    deliverySignature: text('delivery_signature'), // Base64 signature or URL
    deliveryPhoto: text('delivery_photo'), // Photo proof URL

    cancelledAt: timestamp('cancelled_at', { mode: 'date' }),
    cancelledBy: uuid('cancelled_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    cancellationReason: text('cancellation_reason'),

    // Zoho Books integration
    zohoInvoiceId: text('zoho_invoice_id'),
    zohoInvoiceNumber: text('zoho_invoice_number'),
    zohoInvoiceStatus: text('zoho_invoice_status'),
    zohoLastSyncAt: timestamp('zoho_last_sync_at', { mode: 'date' }),

    ...timestamps,
  },
  (table) => [
    index('private_client_orders_partner_id_idx').on(table.partnerId),
    index('private_client_orders_distributor_id_idx').on(table.distributorId),
    index('private_client_orders_client_id_idx').on(table.clientId),
    index('private_client_orders_status_idx').on(table.status),
    index('private_client_orders_created_at_idx').on(table.createdAt),
    index('private_client_orders_order_number_idx').on(table.orderNumber),
  ],
).enableRLS();

export type PrivateClientOrder = typeof privateClientOrders.$inferSelect;

/**
 * Private client order line items
 */
export const privateClientOrderItems = pgTable(
  'private_client_order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .references(() => privateClientOrders.id, { onDelete: 'cascade' })
      .notNull(),

    // Product references (optional - for inventory items)
    productId: uuid('product_id').references(() => products.id, {
      onDelete: 'set null',
    }),
    productOfferId: uuid('product_offer_id').references(() => productOffers.id, {
      onDelete: 'set null',
    }),

    // Product details (always stored for manual entries and historical record)
    productName: text('product_name').notNull(),
    producer: text('producer'),
    vintage: text('vintage'),
    region: text('region'),
    lwin: text('lwin'),
    bottleSize: text('bottle_size'),
    caseConfig: integer('case_config').default(12),

    // Stock source and status
    source: orderItemSource('source').notNull().default('manual'),
    stockStatus: orderItemStockStatus('stock_status').notNull().default('pending'),
    stockConfirmedAt: timestamp('stock_confirmed_at', { mode: 'date' }),
    stockExpectedAt: timestamp('stock_expected_at', { mode: 'date' }),
    stockNotes: text('stock_notes'),

    // Quantity and pricing
    quantity: integer('quantity').notNull().default(1),
    pricePerCaseUsd: doublePrecision('price_per_case_usd').notNull(),
    totalUsd: doublePrecision('total_usd').notNull(),

    // Line item notes
    notes: text('notes'),

    ...timestamps,
  },
  (table) => [
    index('private_client_order_items_order_id_idx').on(table.orderId),
    index('private_client_order_items_product_id_idx').on(table.productId),
    index('private_client_order_items_source_idx').on(table.source),
    index('private_client_order_items_stock_status_idx').on(table.stockStatus),
  ],
).enableRLS();

export type PrivateClientOrderItem = typeof privateClientOrderItems.$inferSelect;

/**
 * Private client order documents (invoices, payment proofs)
 */
export const privateClientOrderDocuments = pgTable(
  'private_client_order_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .references(() => privateClientOrders.id, { onDelete: 'cascade' })
      .notNull(),

    // Document type
    documentType: privateClientDocumentType('document_type').notNull(),

    // File storage
    fileUrl: text('file_url').notNull(),
    fileName: text('file_name').notNull(),
    fileSize: integer('file_size'),
    mimeType: text('mime_type'),

    // Upload info
    uploadedBy: uuid('uploaded_by')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    uploadedAt: timestamp('uploaded_at', { mode: 'date' }).notNull().defaultNow(),

    // AI extraction
    extractionStatus: documentExtractionStatus('extraction_status')
      .notNull()
      .default('pending'),
    extractedData: jsonb('extracted_data').$type<{
      invoiceNumber?: string;
      invoiceDate?: string;
      totalAmount?: number;
      currency?: string;
      lineItems?: Array<{
        productName?: string;
        quantity?: number;
        unitPrice?: number;
        total?: number;
      }>;
      paymentReference?: string;
      rawText?: string;
    }>(),
    extractionError: text('extraction_error'),
    extractedAt: timestamp('extracted_at', { mode: 'date' }),

    // Matching
    isMatched: boolean('is_matched').notNull().default(false),
    matchedAt: timestamp('matched_at', { mode: 'date' }),
    matchNotes: text('match_notes'),

    ...timestamps,
  },
  (table) => [
    index('private_client_order_documents_order_id_idx').on(table.orderId),
    index('private_client_order_documents_document_type_idx').on(
      table.documentType,
    ),
    index('private_client_order_documents_extraction_status_idx').on(
      table.extractionStatus,
    ),
  ],
).enableRLS();

export type PrivateClientOrderDocument =
  typeof privateClientOrderDocuments.$inferSelect;

/**
 * Private client order activity logs (audit trail)
 */
export const privateClientOrderActivityLogs = pgTable(
  'private_client_order_activity_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .references(() => privateClientOrders.id, { onDelete: 'cascade' })
      .notNull(),

    // Who performed the action
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    partnerId: uuid('partner_id').references(() => partners.id, {
      onDelete: 'set null',
    }),

    // Action details
    action: text('action').notNull(),
    previousStatus: privateClientOrderStatus('previous_status'),
    newStatus: privateClientOrderStatus('new_status'),

    // Additional context
    metadata: jsonb('metadata'),
    notes: text('notes'),

    // Client data access logging (HNWI protection)
    accessedClientData: boolean('accessed_client_data').notNull().default(false),
    clientDataFields: jsonb('client_data_fields').$type<string[]>(),

    // Request info
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),

    ...timestamps,
  },
  (table) => [
    index('private_client_order_activity_logs_order_id_idx').on(table.orderId),
    index('private_client_order_activity_logs_user_id_idx').on(table.userId),
    index('private_client_order_activity_logs_created_at_idx').on(
      table.createdAt,
    ),
    index('private_client_order_activity_logs_action_idx').on(table.action),
  ],
).enableRLS();

export type PrivateClientOrderActivityLog =
  typeof privateClientOrderActivityLogs.$inferSelect;

/**
 * Private client contacts (CRM for HNWI)
 */
export const privateClientContacts = pgTable(
  'private_client_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Partner who owns this client relationship
    partnerId: uuid('partner_id')
      .references(() => partners.id, { onDelete: 'cascade' })
      .notNull(),

    // Contact details
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    addressLine1: text('address_line_1'),
    addressLine2: text('address_line_2'),
    city: text('city'),
    stateProvince: text('state_province'),
    postalCode: text('postal_code'),
    country: text('country'),

    // Preferences
    winePreferences: text('wine_preferences'),
    deliveryInstructions: text('delivery_instructions'),
    paymentNotes: text('payment_notes'),

    // Communication
    notes: text('notes'),

    // Stats (denormalized for quick access)
    totalOrders: integer('total_orders').notNull().default(0),
    totalSpendUsd: doublePrecision('total_spend_usd').notNull().default(0),
    lastOrderAt: timestamp('last_order_at', { mode: 'date' }),

    // City Drinks app verification (required for City Drinks distributor orders)
    cityDrinksVerifiedAt: timestamp('city_drinks_verified_at', { mode: 'date' }),
    cityDrinksVerifiedBy: uuid('city_drinks_verified_by').references(
      () => users.id,
      { onDelete: 'set null' },
    ),
    cityDrinksAccountName: text('city_drinks_account_name'),
    cityDrinksPhone: text('city_drinks_phone'),

    ...timestamps,
  },
  (table) => [
    index('private_client_contacts_partner_id_idx').on(table.partnerId),
    index('private_client_contacts_email_idx').on(table.email),
    index('private_client_contacts_name_trigram_idx').using(
      'gin',
      sql`${table.name} gin_trgm_ops`,
    ),
  ],
).enableRLS();

export type PrivateClientContact = typeof privateClientContacts.$inferSelect;

// ============================================================================
// Pricing Configuration
// ============================================================================

export const pricingModule = pgEnum('pricing_module', [
  'b2b',
  'pco',
  'pocket_cellar',
  'exchange_rates',
]);

/**
 * Global pricing configuration for each commercial model
 * Stores default pricing variables that can be overridden at partner or order level
 */
export const pricingConfig = pgTable(
  'pricing_config',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    module: pricingModule('module').notNull(),
    key: text('key').notNull(), // e.g., 'cc_margin_percent', 'duty_percent', 'vat_percent'
    value: doublePrecision('value').notNull(),
    description: text('description'),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    updatedBy: uuid('updated_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    index('pricing_config_module_idx').on(table.module),
    index('pricing_config_module_key_idx').on(table.module, table.key),
  ],
).enableRLS();

export type PricingConfig = typeof pricingConfig.$inferSelect;

/**
 * Order-level pricing overrides for bespoke PCO pricing
 * When admin approves an order with "Bespoke" pricing, custom variables are stored here
 */
export const orderPricingOverrides = pgTable(
  'order_pricing_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .references(() => privateClientOrders.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    // Bespoke pricing variables
    ccMarginPercent: doublePrecision('cc_margin_percent'), // default 2.5% for PCO
    importDutyPercent: doublePrecision('import_duty_percent'), // default 20%
    transferCostPercent: doublePrecision('transfer_cost_percent'), // default 0.75%
    distributorMarginPercent: doublePrecision('distributor_margin_percent'), // default 7.5%
    vatPercent: doublePrecision('vat_percent'), // default 5%
    // Audit
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    notes: text('notes'),
  },
  (table) => [index('order_pricing_overrides_order_id_idx').on(table.orderId)],
).enableRLS();

export type OrderPricingOverride = typeof orderPricingOverrides.$inferSelect;

/**
 * Partner-level pricing overrides for bespoke PCO pricing
 * Partners with custom pricing will use these values as defaults for their orders
 */
export const partnerPricingOverrides = pgTable(
  'partner_pricing_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    partnerId: uuid('partner_id')
      .references(() => partners.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    // Bespoke pricing variables
    ccMarginPercent: doublePrecision('cc_margin_percent'), // default 2.5% for PCO
    importDutyPercent: doublePrecision('import_duty_percent'), // default 20%
    transferCostPercent: doublePrecision('transfer_cost_percent'), // default 0.75%
    distributorMarginPercent: doublePrecision('distributor_margin_percent'), // default 7.5%
    vatPercent: doublePrecision('vat_percent'), // default 5%
    // Effective date range (optional)
    effectiveFrom: timestamp('effective_from', { mode: 'date' }),
    effectiveUntil: timestamp('effective_until', { mode: 'date' }), // null = indefinite
    // Audit
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    notes: text('notes'),
  },
  (table) => [index('partner_pricing_overrides_partner_id_idx').on(table.partnerId)],
).enableRLS();

export type PartnerPricingOverride = typeof partnerPricingOverrides.$inferSelect;

// ============================================================================
// SOURCE Module - RFQ System for Out-of-Stock Items
// ============================================================================

export const sourceRfqStatus = pgEnum('source_rfq_status', [
  'draft',
  'parsing',
  'ready_to_send',
  'sent',
  'collecting',
  'comparing',
  'selecting',
  'client_review', // Admin validating selections with client
  'awaiting_confirmation', // Waiting for partner confirmations
  'confirmed', // All partners have confirmed their quotes
  'quote_generated',
  'closed',
  'cancelled',
]);

export const sourceRfqItemStatus = pgEnum('source_rfq_item_status', [
  'pending',
  'quoted',
  'selected',
  'self_sourced',
  'unsourceable',
  'no_response',
]);

export const sourceRfqPartnerResponseStatus = pgEnum(
  'source_rfq_partner_response_status',
  ['pending', 'viewed', 'in_progress', 'submitted', 'declined', 'expired'],
);

export const sourceRfqQuoteType = pgEnum('source_rfq_quote_type', [
  'exact',
  'alt_vintage', // Same wine, different vintage only
  'alternative', // Completely different product
  'not_available',
]);

export const sourceRfqQuoteConfirmationStatus = pgEnum(
  'source_rfq_quote_confirmation_status',
  [
    'pending', // Confirmation requested, awaiting response
    'confirmed', // Partner confirmed the quote as-is
    'updated', // Partner updated the quote (price/availability changed)
    'rejected', // Partner rejected/can no longer fulfill
    'expired', // Confirmation request expired
  ],
);

/**
 * SOURCE RFQs - main request for quote record
 * Admin creates RFQ from messy client lists, sends to wine partners for pricing
 */
export const sourceRfqs = pgTable(
  'source_rfqs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rfqNumber: text('rfq_number').notNull().unique(),

    // Metadata
    name: text('name').notNull(),
    description: text('description'),
    status: sourceRfqStatus('status').notNull().default('draft'),

    // Source input
    sourceType: text('source_type').notNull(), // 'excel', 'email_text', 'manual'
    sourceFileName: text('source_file_name'),
    sourceFileUrl: text('source_file_url'),
    rawInputText: text('raw_input_text'),
    parsedAt: timestamp('parsed_at', { mode: 'date' }),
    parsingError: text('parsing_error'),

    // Distributor info (B2B trade customer receiving the final quote)
    distributorName: text('distributor_name'),
    distributorEmail: text('distributor_email'),
    distributorCompany: text('distributor_company'),
    distributorNotes: text('distributor_notes'),

    // Deadlines
    responseDeadline: timestamp('response_deadline', { mode: 'date' }),

    // Counts (denormalized)
    itemCount: integer('item_count').notNull().default(0),
    partnerCount: integer('partner_count').notNull().default(0),
    responseCount: integer('response_count').notNull().default(0),

    // Audit
    createdBy: uuid('created_by')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    sentAt: timestamp('sent_at', { mode: 'date' }),
    sentBy: uuid('sent_by').references(() => users.id, { onDelete: 'set null' }),
    closedAt: timestamp('closed_at', { mode: 'date' }),
    closedBy: uuid('closed_by').references(() => users.id, { onDelete: 'set null' }),

    // Client approval tracking
    clientApprovedAt: timestamp('client_approved_at', { mode: 'date' }),
    clientApprovedBy: uuid('client_approved_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    clientApprovalNotes: text('client_approval_notes'),

    // Partner confirmation tracking
    confirmationRequestedAt: timestamp('confirmation_requested_at', { mode: 'date' }),
    confirmationRequestedBy: uuid('confirmation_requested_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    allConfirmedAt: timestamp('all_confirmed_at', { mode: 'date' }),

    ...timestamps,
  },
  (table) => [
    index('source_rfqs_status_idx').on(table.status),
    index('source_rfqs_created_at_idx').on(table.createdAt),
    index('source_rfqs_created_by_idx').on(table.createdBy),
  ],
).enableRLS();

export type SourceRfq = typeof sourceRfqs.$inferSelect;

/**
 * SOURCE RFQ Items - line items parsed from client request
 */
export const sourceRfqItems = pgTable(
  'source_rfq_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rfqId: uuid('rfq_id')
      .references(() => sourceRfqs.id, { onDelete: 'cascade' })
      .notNull(),

    // Item details (parsed from input or manually entered)
    productName: text('product_name').notNull(),
    producer: text('producer'),
    vintage: text('vintage'),
    region: text('region'),
    country: text('country'),
    bottleSize: text('bottle_size'),
    caseConfig: integer('case_config'),
    lwin: text('lwin'),

    // Requested quantity
    quantity: integer('quantity').notNull().default(1),
    quantityUnit: text('quantity_unit').notNull().default('cases'), // 'cases' | 'bottles'

    // Original text from source (for reference)
    originalText: text('original_text'),

    // AI parsing confidence (0-1)
    parseConfidence: doublePrecision('parse_confidence'),

    // Status
    status: sourceRfqItemStatus('status').notNull().default('pending'),

    // Selected winning quote
    selectedQuoteId: uuid('selected_quote_id'),
    selectedAt: timestamp('selected_at', { mode: 'date' }),
    selectedBy: uuid('selected_by').references(() => users.id, { onDelete: 'set null' }),

    // Final pricing (after admin adjustment)
    calculatedPriceUsd: doublePrecision('calculated_price_usd'),
    finalPriceUsd: doublePrecision('final_price_usd'),
    priceAdjustedBy: uuid('price_adjusted_by').references(() => users.id, {
      onDelete: 'set null',
    }),

    // Notes
    adminNotes: text('admin_notes'),

    // Sort order
    sortOrder: integer('sort_order').notNull().default(0),

    ...timestamps,
  },
  (table) => [
    index('source_rfq_items_rfq_id_idx').on(table.rfqId),
    index('source_rfq_items_status_idx').on(table.status),
  ],
).enableRLS();

export type SourceRfqItem = typeof sourceRfqItems.$inferSelect;

/**
 * SOURCE RFQ Partners - wine partners assigned to quote on an RFQ
 */
export const sourceRfqPartners = pgTable(
  'source_rfq_partners',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rfqId: uuid('rfq_id')
      .references(() => sourceRfqs.id, { onDelete: 'cascade' })
      .notNull(),
    partnerId: uuid('partner_id')
      .references(() => partners.id, { onDelete: 'cascade' })
      .notNull(),

    // Response status
    status: sourceRfqPartnerResponseStatus('status').notNull().default('pending'),

    // Tracking
    notifiedAt: timestamp('notified_at', { mode: 'date' }),
    viewedAt: timestamp('viewed_at', { mode: 'date' }),
    submittedAt: timestamp('submitted_at', { mode: 'date' }),
    declinedAt: timestamp('declined_at', { mode: 'date' }),
    declineReason: text('decline_reason'),

    // Partner notes
    partnerNotes: text('partner_notes'),

    // Count of quotes submitted
    quoteCount: integer('quote_count').notNull().default(0),

    ...timestamps,
  },
  (table) => [
    index('source_rfq_partners_rfq_id_idx').on(table.rfqId),
    index('source_rfq_partners_partner_id_idx').on(table.partnerId),
    index('source_rfq_partners_status_idx').on(table.status),
  ],
).enableRLS();

export type SourceRfqPartner = typeof sourceRfqPartners.$inferSelect;

/**
 * SOURCE RFQ Partner Contacts - tracks which contacts were notified for an RFQ
 */
export const sourceRfqPartnerContacts = pgTable(
  'source_rfq_partner_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rfqPartnerId: uuid('rfq_partner_id')
      .references(() => sourceRfqPartners.id, { onDelete: 'cascade' })
      .notNull(),
    contactId: uuid('contact_id')
      .references(() => partnerContacts.id, { onDelete: 'cascade' })
      .notNull(),
    notifiedAt: timestamp('notified_at', { mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    index('source_rfq_partner_contacts_rfq_partner_id_idx').on(table.rfqPartnerId),
    index('source_rfq_partner_contacts_contact_id_idx').on(table.contactId),
  ],
).enableRLS();

export type SourceRfqPartnerContact = typeof sourceRfqPartnerContacts.$inferSelect;

/**
 * SOURCE RFQ Quotes - partner quotes for individual items
 */
export const sourceRfqQuotes = pgTable(
  'source_rfq_quotes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rfqId: uuid('rfq_id')
      .references(() => sourceRfqs.id, { onDelete: 'cascade' })
      .notNull(),
    itemId: uuid('item_id')
      .references(() => sourceRfqItems.id, { onDelete: 'cascade' })
      .notNull(),
    rfqPartnerId: uuid('rfq_partner_id')
      .references(() => sourceRfqPartners.id, { onDelete: 'cascade' })
      .notNull(),
    partnerId: uuid('partner_id')
      .references(() => partners.id, { onDelete: 'cascade' })
      .notNull(),

    // Quote type
    quoteType: sourceRfqQuoteType('quote_type').notNull().default('exact'),

    // Quoted vintage - which specific vintage the partner is quoting on
    // (needed when RFQ item has multiple vintages like "2018, 2016, 2013")
    quotedVintage: text('quoted_vintage'),

    // For alternatives: product details
    alternativeProductName: text('alternative_product_name'),
    alternativeProducer: text('alternative_producer'),
    alternativeVintage: text('alternative_vintage'),
    alternativeRegion: text('alternative_region'),
    alternativeCountry: text('alternative_country'),
    alternativeBottleSize: text('alternative_bottle_size'),
    alternativeCaseConfig: integer('alternative_case_config'),
    alternativeLwin: text('alternative_lwin'),
    alternativeReason: text('alternative_reason'),

    // For N/A quotes
    notAvailableReason: text('not_available_reason'),

    // Partner's cost price (what they charge C&C) - nullable for N/A quotes
    costPricePerCaseUsd: doublePrecision('cost_price_per_case_usd'),
    currency: text('currency').notNull().default('USD'),
    caseConfig: text('case_config'),
    bottleSize: text('bottle_size'), // e.g., "750ml", "1.5L", "375ml"
    moq: integer('moq'),

    // Availability
    availableQuantity: integer('available_quantity'),
    leadTimeDays: integer('lead_time_days'),
    stockLocation: text('stock_location'),
    stockCondition: text('stock_condition'),

    // Validity
    validUntil: timestamp('valid_until', { mode: 'date' }),

    // Partner notes
    notes: text('notes'),

    // Selection
    isSelected: boolean('is_selected').notNull().default(false),

    // Confirmation (for selected quotes awaiting partner confirmation)
    confirmationStatus: sourceRfqQuoteConfirmationStatus('confirmation_status'),
    confirmationRequestedAt: timestamp('confirmation_requested_at', { mode: 'date' }),
    confirmedAt: timestamp('confirmed_at', { mode: 'date' }),
    confirmationNotes: text('confirmation_notes'),
    // If partner updates their quote during confirmation
    updatedPriceUsd: doublePrecision('updated_price_usd'),
    updatedAvailableQty: integer('updated_available_qty'),
    updateReason: text('update_reason'),

    ...timestamps,
  },
  (table) => [
    index('source_rfq_quotes_rfq_id_idx').on(table.rfqId),
    index('source_rfq_quotes_item_id_idx').on(table.itemId),
    index('source_rfq_quotes_partner_id_idx').on(table.partnerId),
    index('source_rfq_quotes_is_selected_idx').on(table.isSelected),
    index('source_rfq_quotes_confirmation_status_idx').on(table.confirmationStatus),
  ],
).enableRLS();

export type SourceRfqQuote = typeof sourceRfqQuotes.$inferSelect;

/**
 * SOURCE RFQ Activity Logs - audit trail for RFQ actions
 */
export const sourceRfqActivityLogs = pgTable(
  'source_rfq_activity_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rfqId: uuid('rfq_id')
      .references(() => sourceRfqs.id, { onDelete: 'cascade' })
      .notNull(),

    // Actor
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    partnerId: uuid('partner_id').references(() => partners.id, { onDelete: 'set null' }),

    // Action
    action: text('action').notNull(),
    previousStatus: sourceRfqStatus('previous_status'),
    newStatus: sourceRfqStatus('new_status'),

    // Context
    metadata: jsonb('metadata'),
    notes: text('notes'),

    ...timestamps,
  },
  (table) => [
    index('source_rfq_activity_logs_rfq_id_idx').on(table.rfqId),
    index('source_rfq_activity_logs_created_at_idx').on(table.createdAt),
  ],
).enableRLS();

export type SourceRfqActivityLog = typeof sourceRfqActivityLogs.$inferSelect;

// ============================================================================
// LWIN (Liv-ex Wine Identification Number) Reference Database
// ============================================================================

/**
 * LWIN status enum - whether the LWIN is actively used
 */
export const lwinStatus = pgEnum('lwin_status', ['live', 'obsolete']);

/**
 * LWIN wine colour enum
 */
export const lwinColour = pgEnum('lwin_colour', [
  'red',
  'white',
  'rose',
  'amber',
  'orange',
  'mixed',
]);

/**
 * LWIN wine type enum
 */
export const lwinType = pgEnum('lwin_type', [
  'wine',
  'fortified',
  'spirit',
  'beer',
  'cider',
  'sake',
  'other',
]);

/**
 * LWIN wines reference table - industry standard wine identifiers
 * Data sourced from Liv-ex LWIN database (~208,000 wines)
 */
export const lwinWines = pgTable(
  'lwin_wines',
  {
    // LWIN is the primary key - 7-digit unique identifier
    lwin: text('lwin').primaryKey(),

    // Status
    status: lwinStatus('status').notNull().default('live'),

    // Wine identification
    displayName: text('display_name').notNull(),
    producerTitle: text('producer_title'),
    producerName: text('producer_name'),
    wine: text('wine'),

    // Geography
    country: text('country'),
    region: text('region'),
    subRegion: text('sub_region'),
    site: text('site'),
    parcel: text('parcel'),

    // Wine characteristics
    colour: lwinColour('colour'),
    type: lwinType('type'),
    subType: text('sub_type'),

    // Classification
    designation: text('designation'),
    classification: text('classification'),

    // Vintage info
    vintageConfig: text('vintage_config'),
    firstVintage: text('first_vintage'),
    finalVintage: text('final_vintage'),

    // Metadata
    reference: text('reference'),
    dateAdded: timestamp('date_added', { mode: 'date' }),
    dateUpdated: timestamp('date_updated', { mode: 'date' }),

    ...timestamps,
  },
  (table) => [
    // Regular indexes
    index('lwin_wines_country_idx').on(table.country),
    index('lwin_wines_region_idx').on(table.region),
    index('lwin_wines_colour_idx').on(table.colour),
    index('lwin_wines_status_idx').on(table.status),
    // Trigram indexes for fuzzy matching
    index('lwin_wines_display_name_trigram_idx').using(
      'gin',
      sql`${table.displayName} gin_trgm_ops`,
    ),
    index('lwin_wines_producer_name_trigram_idx').using(
      'gin',
      sql`${table.producerName} gin_trgm_ops`,
    ),
    index('lwin_wines_wine_trigram_idx').using(
      'gin',
      sql`${table.wine} gin_trgm_ops`,
    ),
    // Full-text search index for keyword matching
    index('lwin_wines_fts_idx').using(
      'gin',
      sql`(
        setweight(to_tsvector('english', coalesce(${table.displayName}, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(${table.producerName}, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(${table.wine}, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(${table.region}, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(${table.country}, '')), 'C')
      )`,
    ),
  ],
).enableRLS();

export type LwinWine = typeof lwinWines.$inferSelect;

// ============================================================================
// SOURCE Module - Purchase Orders (Post-Selection Workflow)
// ============================================================================

export const sourcePurchaseOrderStatus = pgEnum('source_purchase_order_status', [
  'draft',
  'sent',
  'confirmed',
  'partially_confirmed',
  'shipped',
  'delivered',
  'cancelled',
]);

export const sourcePurchaseOrderItemStatus = pgEnum('source_purchase_order_item_status', [
  'pending',
  'confirmed',
  'rejected',
]);

/**
 * SOURCE Purchase Orders - one per partner with selected quotes
 * Generated after admin finalizes RFQ selections
 */
export const sourcePurchaseOrders = pgTable(
  'source_purchase_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rfqId: uuid('rfq_id')
      .references(() => sourceRfqs.id, { onDelete: 'cascade' })
      .notNull(),
    partnerId: uuid('partner_id')
      .references(() => partners.id, { onDelete: 'restrict' })
      .notNull(),

    // PO identification
    poNumber: text('po_number').notNull().unique(),
    status: sourcePurchaseOrderStatus('status').notNull().default('draft'),

    // Pricing
    totalAmountUsd: doublePrecision('total_amount_usd'),
    currency: text('currency').notNull().default('USD'),

    // Delivery
    deliveryDate: timestamp('delivery_date', { mode: 'date' }),
    deliveryAddress: text('delivery_address'),
    deliveryInstructions: text('delivery_instructions'),

    // Terms
    paymentTerms: text('payment_terms'),
    notes: text('notes'),

    // PDF
    pdfUrl: text('pdf_url'),

    // Workflow timestamps
    sentAt: timestamp('sent_at', { mode: 'date' }),
    sentBy: uuid('sent_by').references(() => users.id, { onDelete: 'set null' }),
    confirmedAt: timestamp('confirmed_at', { mode: 'date' }),
    confirmedBy: uuid('confirmed_by'), // Partner user - no FK as might be external
    confirmationNotes: text('confirmation_notes'),
    estimatedDeliveryDate: timestamp('estimated_delivery_date', { mode: 'date' }),
    shippedAt: timestamp('shipped_at', { mode: 'date' }),
    trackingNumber: text('tracking_number'),
    shippingNotes: text('shipping_notes'),
    deliveredAt: timestamp('delivered_at', { mode: 'date' }),
    deliveryNotes: text('delivery_notes'),
    cancelledAt: timestamp('cancelled_at', { mode: 'date' }),
    cancelledBy: uuid('cancelled_by').references(() => users.id, { onDelete: 'set null' }),
    cancellationReason: text('cancellation_reason'),

    // Audit
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    index('source_purchase_orders_rfq_id_idx').on(table.rfqId),
    index('source_purchase_orders_partner_id_idx').on(table.partnerId),
    index('source_purchase_orders_status_idx').on(table.status),
    index('source_purchase_orders_po_number_idx').on(table.poNumber),
  ],
).enableRLS();

export type SourcePurchaseOrder = typeof sourcePurchaseOrders.$inferSelect;

/**
 * SOURCE Purchase Order Items - line items from selected quotes
 */
export const sourcePurchaseOrderItems = pgTable(
  'source_purchase_order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    poId: uuid('po_id')
      .references(() => sourcePurchaseOrders.id, { onDelete: 'cascade' })
      .notNull(),
    rfqItemId: uuid('rfq_item_id')
      .references(() => sourceRfqItems.id, { onDelete: 'restrict' })
      .notNull(),
    quoteId: uuid('quote_id')
      .references(() => sourceRfqQuotes.id, { onDelete: 'restrict' })
      .notNull(),

    // Product details (denormalized for PO)
    productName: text('product_name').notNull(),
    producer: text('producer'),
    vintage: text('vintage'),
    lwin: text('lwin'),

    // Quantity and pricing
    quantity: integer('quantity').notNull(),
    unitType: text('unit_type').notNull().default('case'), // 'case' | 'bottle'
    caseConfig: integer('case_config'),
    unitPriceUsd: doublePrecision('unit_price_usd').notNull(),
    lineTotalUsd: doublePrecision('line_total_usd').notNull(),

    // Item-level confirmation status
    status: sourcePurchaseOrderItemStatus('status').notNull().default('pending'),
    confirmedAt: timestamp('confirmed_at', { mode: 'date' }),
    rejectionReason: text('rejection_reason'),

    // Notes
    notes: text('notes'),

    ...timestamps,
  },
  (table) => [
    index('source_purchase_order_items_po_id_idx').on(table.poId),
    index('source_purchase_order_items_rfq_item_id_idx').on(table.rfqItemId),
    index('source_purchase_order_items_status_idx').on(table.status),
  ],
).enableRLS();

export type SourcePurchaseOrderItem = typeof sourcePurchaseOrderItems.$inferSelect;

// ============================================================================
// SOURCE Module - Market Intelligence (Price Comparison)
// ============================================================================

/**
 * SOURCE Market Prices - historical quote data for market intelligence
 * Updated after quote selections to track market pricing trends
 */
export const sourceMarketPrices = pgTable(
  'source_market_prices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lwin: text('lwin').notNull().unique(),

    // Price statistics
    avgPriceUsd: doublePrecision('avg_price_usd'),
    minPriceUsd: doublePrecision('min_price_usd'),
    maxPriceUsd: doublePrecision('max_price_usd'),
    quoteCount: integer('quote_count').notNull().default(0),

    // Last quote details
    lastQuotedAt: timestamp('last_quoted_at', { mode: 'date' }),
    lastQuotedBy: uuid('last_quoted_by').references(() => partners.id, {
      onDelete: 'set null',
    }),
    lastQuotePrice: doublePrecision('last_quote_price'),

    ...timestamps,
  },
  (table) => [
    index('source_market_prices_lwin_idx').on(table.lwin),
  ],
).enableRLS();

export type SourceMarketPrice = typeof sourceMarketPrices.$inferSelect;

/**
 * SOURCE Partner Metrics - performance tracking for wine partners
 */
export const sourcePartnerMetrics = pgTable(
  'source_partner_metrics',
  {
    partnerId: uuid('partner_id')
      .primaryKey()
      .references(() => partners.id, { onDelete: 'cascade' }),

    // Response stats
    totalRfqsReceived: integer('total_rfqs_received').notNull().default(0),
    totalRfqsResponded: integer('total_rfqs_responded').notNull().default(0),
    avgResponseTimeHours: doublePrecision('avg_response_time_hours'),

    // Quote stats
    totalQuotesSubmitted: integer('total_quotes_submitted').notNull().default(0),
    totalQuotesWon: integer('total_quotes_won').notNull().default(0),
    totalValueWonUsd: doublePrecision('total_value_won_usd').notNull().default(0),

    // Performance metrics
    responseRate: doublePrecision('response_rate'), // % of RFQs responded to
    winRate: doublePrecision('win_rate'), // % of quotes that were selected
    bestPriceRate: doublePrecision('best_price_rate'), // % of time they had the best price

    // Trends
    lastRfqReceivedAt: timestamp('last_rfq_received_at', { mode: 'date' }),
    lastResponseAt: timestamp('last_response_at', { mode: 'date' }),
    lastWinAt: timestamp('last_win_at', { mode: 'date' }),

    ...timestamps,
  },
  (table) => [
    index('source_partner_metrics_response_rate_idx').on(table.responseRate),
    index('source_partner_metrics_win_rate_idx').on(table.winRate),
  ],
).enableRLS();

export type SourcePartnerMetric = typeof sourcePartnerMetrics.$inferSelect;

// ============================================================================
// SOURCE Module - Wine Synonyms (AI Matching Enhancement)
// ============================================================================

export const wineSynonymType = pgEnum('wine_synonym_type', [
  'producer',
  'grape',
  'region',
  'abbreviation',
]);

/**
 * Wine Synonyms - for enhanced AI matching
 * Maps abbreviations and alternative names to canonical forms
 */
export const wineSynonyms = pgTable(
  'wine_synonyms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    canonical: text('canonical').notNull(), // e.g., "Domaine de la Romanée-Conti"
    synonym: text('synonym').notNull(), // e.g., "DRC"
    type: wineSynonymType('type').notNull(),
    confidence: doublePrecision('confidence').notNull().default(1.0),
    isVerified: boolean('is_verified').notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index('wine_synonyms_synonym_idx').on(table.synonym),
    index('wine_synonyms_canonical_idx').on(table.canonical),
    index('wine_synonyms_type_idx').on(table.type),
    index('wine_synonyms_synonym_trigram_idx').using(
      'gin',
      sql`${table.synonym} gin_trgm_ops`,
    ),
  ],
).enableRLS();

export type WineSynonym = typeof wineSynonyms.$inferSelect;

// ============================================================================
// SOURCE Module - Self-Sourcing Workflow
// ============================================================================

export const sourceSelfSourcingStatus = pgEnum('source_self_sourcing_status', [
  'pending',
  'available',
  'ordered',
  'received',
  'cancelled',
]);

export const sourceSelfSourcingSource = pgEnum('source_self_sourcing_source', [
  'inventory',
  'exchange',
  'direct',
  'other',
]);

/**
 * SOURCE Self-Sourcing - tracks C&C self-sourcing for unfulfilled items
 * Used when no partner can supply an item
 */
export const sourceSelfSourcing = pgTable(
  'source_self_sourcing',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rfqItemId: uuid('rfq_item_id')
      .references(() => sourceRfqItems.id, { onDelete: 'cascade' })
      .notNull(),

    // Sourcing details
    source: sourceSelfSourcingSource('source').notNull(),
    sourceDetails: text('source_details'), // e.g., "Liv-ex", "Direct from producer"
    sourceReference: text('source_reference'), // Order/reference number

    // Pricing
    costPriceUsd: doublePrecision('cost_price_usd'),
    quantity: integer('quantity'),

    // Status
    status: sourceSelfSourcingStatus('status').notNull().default('pending'),
    notes: text('notes'),

    // Timestamps
    orderedAt: timestamp('ordered_at', { mode: 'date' }),
    expectedAt: timestamp('expected_at', { mode: 'date' }),
    receivedAt: timestamp('received_at', { mode: 'date' }),
    cancelledAt: timestamp('cancelled_at', { mode: 'date' }),

    // Audit
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    createdBy: uuid('created_by')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('source_self_sourcing_rfq_item_id_idx').on(table.rfqItemId),
    index('source_self_sourcing_status_idx').on(table.status),
    index('source_self_sourcing_source_idx').on(table.source),
  ],
).enableRLS();

export type SourceSelfSourcing = typeof sourceSelfSourcing.$inferSelect;

// ============================================================================
// SOURCE Module - Customer Purchase Orders (Incoming POs from Customers)
// ============================================================================

export const sourceCustomerPoStatus = pgEnum('source_customer_po_status', [
  'draft',
  'parsing',
  'matching',
  'matched',
  'reviewing',
  'orders_generated',
  'awaiting_confirmations',
  'confirmed',
  'closed',
  'cancelled',
]);

export const sourceCustomerPoItemStatus = pgEnum('source_customer_po_item_status', [
  'pending_match',
  'matched',
  'unmatched',
  'new_item',
  'ordered',
  'confirmed',
]);

export const sourceCustomerPoItemMatchSource = pgEnum('source_customer_po_item_match_source', [
  'auto',
  'manual',
  'new_item',
]);

export const sourceSupplierOrderStatus = pgEnum('source_supplier_order_status', [
  'draft',
  'sent',
  'pending_confirmation',
  'confirmed',
  'partial',
  'rejected',
  'shipped',
  'delivered',
  'cancelled',
]);

export const sourceSupplierOrderItemConfirmationStatus = pgEnum(
  'source_supplier_order_item_confirmation_status',
  ['pending', 'confirmed', 'updated', 'rejected'],
);

/**
 * SOURCE Customer POs - POs received from B2B customers
 * Tracks customer orders, matches against RFQ quotes, calculates profit
 */
export const sourceCustomerPos = pgTable(
  'source_customer_pos',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Optional link to RFQ (can work standalone too)
    rfqId: uuid('rfq_id').references(() => sourceRfqs.id, { onDelete: 'set null' }),

    // PO identification
    poNumber: text('po_number').notNull(), // Customer's PO number
    ccPoNumber: text('cc_po_number').notNull().unique(), // Our internal reference (CPO-2026-0001)
    status: sourceCustomerPoStatus('status').notNull().default('draft'),

    // Customer info
    customerName: text('customer_name').notNull(),
    customerCompany: text('customer_company'),
    customerEmail: text('customer_email'),
    customerPhone: text('customer_phone'),

    // Source document
    sourceType: text('source_type'), // 'excel', 'pdf', 'manual'
    sourceFileName: text('source_file_name'),
    sourceFileUrl: text('source_file_url'),
    rawContent: text('raw_content'), // For AI parsing reference

    // Pricing summary (calculated)
    totalSellPriceUsd: doublePrecision('total_sell_price_usd').default(0),
    totalBuyPriceUsd: doublePrecision('total_buy_price_usd').default(0),
    totalProfitUsd: doublePrecision('total_profit_usd').default(0),
    profitMarginPercent: doublePrecision('profit_margin_percent').default(0),
    itemCount: integer('item_count').default(0),
    losingItemCount: integer('losing_item_count').default(0),

    // Workflow timestamps
    parsedAt: timestamp('parsed_at', { mode: 'date' }),
    matchedAt: timestamp('matched_at', { mode: 'date' }),
    ordersGeneratedAt: timestamp('orders_generated_at', { mode: 'date' }),
    allConfirmedAt: timestamp('all_confirmed_at', { mode: 'date' }),

    // Notes
    adminNotes: text('admin_notes'),

    // Audit
    createdBy: uuid('created_by')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    ...timestamps,
  },
  (table) => [
    index('source_customer_pos_status_idx').on(table.status),
    index('source_customer_pos_rfq_id_idx').on(table.rfqId),
    index('source_customer_pos_created_at_idx').on(table.createdAt),
  ],
).enableRLS();

export type SourceCustomerPo = typeof sourceCustomerPos.$inferSelect;

/**
 * SOURCE Customer PO Items - line items parsed from customer PO
 * Matched against RFQ quotes to calculate profit margins
 */
export const sourceCustomerPoItems = pgTable(
  'source_customer_po_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerPoId: uuid('customer_po_id')
      .references(() => sourceCustomerPos.id, { onDelete: 'cascade' })
      .notNull(),

    // Product info (parsed from PO)
    productName: text('product_name').notNull(),
    producer: text('producer'),
    vintage: text('vintage'),
    region: text('region'),
    bottleSize: text('bottle_size'),
    caseConfig: integer('case_config'),
    lwin: text('lwin'),

    // Quantity
    quantity: integer('quantity').notNull(),
    quantityUnit: text('quantity_unit').default('cases'), // 'cases' | 'bottles'

    // Customer pricing (sell side - what customer pays us)
    sellPricePerBottleUsd: doublePrecision('sell_price_per_bottle_usd'),
    sellPricePerCaseUsd: doublePrecision('sell_price_per_case_usd'),
    sellLineTotalUsd: doublePrecision('sell_line_total_usd'),

    // Matched quote (buy side - our cost)
    matchedRfqItemId: uuid('matched_rfq_item_id').references(() => sourceRfqItems.id, {
      onDelete: 'set null',
    }),
    matchedQuoteId: uuid('matched_quote_id').references(() => sourceRfqQuotes.id, {
      onDelete: 'set null',
    }),
    matchSource: sourceCustomerPoItemMatchSource('match_source'),
    matchConfidence: doublePrecision('match_confidence'),

    // Cost pricing (from matched quote or manual entry)
    buyPricePerBottleUsd: doublePrecision('buy_price_per_bottle_usd'),
    buyPricePerCaseUsd: doublePrecision('buy_price_per_case_usd'),
    buyLineTotalUsd: doublePrecision('buy_line_total_usd'),

    // Profit calculation
    profitUsd: doublePrecision('profit_usd'),
    profitMarginPercent: doublePrecision('profit_margin_percent'),
    isLosingItem: boolean('is_losing_item').default(false), // buy > sell

    // Status
    status: sourceCustomerPoItemStatus('status').notNull().default('pending_match'),

    // Notes
    adminNotes: text('admin_notes'),
    originalText: text('original_text'), // Original line from parsed document

    // Sort order
    sortOrder: integer('sort_order').default(0),

    ...timestamps,
  },
  (table) => [
    index('source_customer_po_items_customer_po_id_idx').on(table.customerPoId),
    index('source_customer_po_items_status_idx').on(table.status),
    index('source_customer_po_items_matched_quote_id_idx').on(table.matchedQuoteId),
    index('source_customer_po_items_is_losing_item_idx').on(table.isLosingItem),
  ],
).enableRLS();

export type SourceCustomerPoItem = typeof sourceCustomerPoItems.$inferSelect;

/**
 * SOURCE Supplier Orders - orders sent to suppliers/partners (one per partner per customer PO)
 * Generated from customer PO items grouped by winning partner
 */
export const sourceSupplierOrders = pgTable(
  'source_supplier_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerPoId: uuid('customer_po_id')
      .references(() => sourceCustomerPos.id, { onDelete: 'cascade' })
      .notNull(),
    partnerId: uuid('partner_id')
      .references(() => partners.id, { onDelete: 'restrict' })
      .notNull(),

    // Order identification
    orderNumber: text('order_number').notNull().unique(), // SO-2026-0001
    status: sourceSupplierOrderStatus('status').notNull().default('draft'),

    // Totals
    itemCount: integer('item_count').default(0),
    totalAmountUsd: doublePrecision('total_amount_usd').default(0),
    confirmedAmountUsd: doublePrecision('confirmed_amount_usd'),

    // Generated documents
    excelFileUrl: text('excel_file_url'),
    pdfFileUrl: text('pdf_file_url'),

    // Workflow timestamps
    sentAt: timestamp('sent_at', { mode: 'date' }),
    sentBy: uuid('sent_by').references(() => users.id, { onDelete: 'set null' }),
    notifiedAt: timestamp('notified_at', { mode: 'date' }),
    viewedAt: timestamp('viewed_at', { mode: 'date' }),
    confirmedAt: timestamp('confirmed_at', { mode: 'date' }),
    confirmedBy: uuid('confirmed_by'), // Partner user (no FK as might be external)

    // Shipping
    shippedAt: timestamp('shipped_at', { mode: 'date' }),
    trackingNumber: text('tracking_number'),
    deliveredAt: timestamp('delivered_at', { mode: 'date' }),

    // Notes
    adminNotes: text('admin_notes'),
    partnerNotes: text('partner_notes'),

    // Audit
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (table) => [
    index('source_supplier_orders_customer_po_id_idx').on(table.customerPoId),
    index('source_supplier_orders_partner_id_idx').on(table.partnerId),
    index('source_supplier_orders_status_idx').on(table.status),
  ],
).enableRLS();

export type SourceSupplierOrder = typeof sourceSupplierOrders.$inferSelect;

/**
 * SOURCE Supplier Order Items - line items in orders to suppliers
 * Includes confirmation status for partner response tracking
 */
export const sourceSupplierOrderItems = pgTable(
  'source_supplier_order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    supplierOrderId: uuid('supplier_order_id')
      .references(() => sourceSupplierOrders.id, { onDelete: 'cascade' })
      .notNull(),
    customerPoItemId: uuid('customer_po_item_id')
      .references(() => sourceCustomerPoItems.id, { onDelete: 'restrict' })
      .notNull(),
    quoteId: uuid('quote_id').references(() => sourceRfqQuotes.id, { onDelete: 'set null' }),

    // Product details (denormalized for order document)
    productName: text('product_name').notNull(),
    producer: text('producer'),
    vintage: text('vintage'),
    region: text('region'),
    lwin7: text('lwin7'),
    lwin18: text('lwin18'),
    bottleSize: text('bottle_size'),
    caseConfig: integer('case_config'),

    // Quantity and pricing
    quantityCases: integer('quantity_cases').notNull(),
    quantityBottles: integer('quantity_bottles'),
    costPerBottleUsd: doublePrecision('cost_per_bottle_usd'),
    costPerCaseUsd: doublePrecision('cost_per_case_usd').notNull(),
    lineTotalUsd: doublePrecision('line_total_usd').notNull(),

    // Partner confirmation
    confirmationStatus: sourceSupplierOrderItemConfirmationStatus('confirmation_status')
      .notNull()
      .default('pending'),
    confirmedAt: timestamp('confirmed_at', { mode: 'date' }),
    updatedPriceUsd: doublePrecision('updated_price_usd'), // If partner updates price
    updatedQuantity: integer('updated_quantity'), // If partner updates availability
    updateReason: text('update_reason'),
    rejectionReason: text('rejection_reason'),
    partnerNotes: text('partner_notes'),

    // Sort order
    sortOrder: integer('sort_order').default(0),

    ...timestamps,
  },
  (table) => [
    index('source_supplier_order_items_supplier_order_id_idx').on(table.supplierOrderId),
    index('source_supplier_order_items_customer_po_item_id_idx').on(table.customerPoItemId),
    index('source_supplier_order_items_confirmation_status_idx').on(table.confirmationStatus),
  ],
).enableRLS();

export type SourceSupplierOrderItem = typeof sourceSupplierOrderItems.$inferSelect;

// ============================================================================
// Logistics Module
// ============================================================================

/**
 * Shipment direction/type
 */
export const logisticsShipmentType = pgEnum('logistics_shipment_type', [
  'inbound', // Partner to UAE warehouse
  'outbound', // UAE warehouse to client
  're_export', // UAE warehouse to another destination
]);

/**
 * Transport mode
 */
export const logisticsTransportMode = pgEnum('logistics_transport_mode', [
  'sea_fcl', // Full container load
  'sea_lcl', // Less than container load
  'air',
  'road',
]);

/**
 * Shipment status pipeline
 */
export const logisticsShipmentStatus = pgEnum('logistics_shipment_status', [
  'draft', // Initial creation
  'booked', // Carrier booking confirmed
  'picked_up', // Cargo collected from origin
  'in_transit', // On the way
  'arrived_port', // Arrived at destination port
  'customs_clearance', // Going through customs
  'cleared', // Customs cleared
  'at_warehouse', // At RAK Port warehouse
  'partially_received', // Some items received, receiving in progress
  'dispatched', // Sent out for delivery (outbound)
  'delivered', // Final delivery complete
  'cancelled', // Cancelled
]);

/**
 * Document types for logistics
 */
export const logisticsDocumentType = pgEnum('logistics_document_type', [
  'bill_of_lading',
  'airway_bill',
  'commercial_invoice',
  'packing_list',
  'certificate_of_origin',
  'customs_declaration',
  'import_permit',
  'export_permit',
  'delivery_note',
  'health_certificate',
  'insurance_certificate',
  'proof_of_delivery',
  'other',
]);

/**
 * Cost allocation method for landed cost calculation
 */
export const logisticsCostAllocationMethod = pgEnum('logistics_cost_allocation_method', [
  'by_bottle', // Split costs by number of bottles
  'by_weight', // Split costs by weight
  'by_value', // Split costs by declared value
]);

/**
 * Logistics shipments - main shipment tracking table
 */
export const logisticsShipments = pgTable(
  'logistics_shipments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shipmentNumber: text('shipment_number').notNull().unique(),

    // Shipment type and mode
    type: logisticsShipmentType('type').notNull(),
    transportMode: logisticsTransportMode('transport_mode').notNull(),
    status: logisticsShipmentStatus('status').notNull().default('draft'),

    // Partner (inbound) or Client (outbound)
    partnerId: uuid('partner_id').references(() => partners.id, {
      onDelete: 'restrict',
    }),
    clientContactId: uuid('client_contact_id').references(() => privateClientContacts.id, {
      onDelete: 'set null',
    }),

    // Origin location
    originCountry: text('origin_country'),
    originCity: text('origin_city'),
    originWarehouse: text('origin_warehouse'),

    // Destination location
    destinationCountry: text('destination_country'),
    destinationCity: text('destination_city'),
    destinationWarehouse: text('destination_warehouse').default('RAK Port'),

    // Carrier info
    carrierName: text('carrier_name'),
    carrierBookingRef: text('carrier_booking_ref'),
    containerNumber: text('container_number'), // For sea freight
    blNumber: text('bl_number'), // Bill of Lading number
    awbNumber: text('awb_number'), // Airway Bill number

    // Hillebrand integration
    hillebrandShipmentId: integer('hillebrand_shipment_id'),
    hillebrandReference: text('hillebrand_reference'),
    hillebrandLastSync: timestamp('hillebrand_last_sync', { mode: 'date' }),

    // Timeline
    etd: timestamp('etd', { mode: 'date' }), // Estimated Time of Departure
    atd: timestamp('atd', { mode: 'date' }), // Actual Time of Departure
    eta: timestamp('eta', { mode: 'date' }), // Estimated Time of Arrival
    ata: timestamp('ata', { mode: 'date' }), // Actual Time of Arrival
    deliveredAt: timestamp('delivered_at', { mode: 'date' }),

    // Cargo details
    totalCases: integer('total_cases').default(0),
    totalBottles: integer('total_bottles').default(0),
    totalPallets: integer('total_pallets'),
    totalWeightKg: doublePrecision('total_weight_kg'),
    totalVolumeM3: doublePrecision('total_volume_m3'),

    // Cost tracking (what C&C pays)
    freightCostUsd: doublePrecision('freight_cost_usd'),
    insuranceCostUsd: doublePrecision('insurance_cost_usd'),
    originHandlingUsd: doublePrecision('origin_handling_usd'),
    destinationHandlingUsd: doublePrecision('destination_handling_usd'),
    customsClearanceUsd: doublePrecision('customs_clearance_usd'),
    govFeesUsd: doublePrecision('gov_fees_usd'),
    deliveryCostUsd: doublePrecision('delivery_cost_usd'),
    otherCostsUsd: doublePrecision('other_costs_usd'),
    totalLandedCostUsd: doublePrecision('total_landed_cost_usd'),

    // Cost allocation method
    costAllocationMethod: logisticsCostAllocationMethod('cost_allocation_method').default(
      'by_bottle',
    ),

    // CO2 emissions (from Hillebrand)
    co2EmissionsTonnes: doublePrecision('co2_emissions_tonnes'),

    // Notes
    internalNotes: text('internal_notes'),
    partnerNotes: text('partner_notes'),

    // Audit
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (table) => [
    index('logistics_shipments_shipment_number_idx').on(table.shipmentNumber),
    index('logistics_shipments_partner_id_idx').on(table.partnerId),
    index('logistics_shipments_client_contact_id_idx').on(table.clientContactId),
    index('logistics_shipments_status_idx').on(table.status),
    index('logistics_shipments_type_idx').on(table.type),
    index('logistics_shipments_hillebrand_id_idx').on(table.hillebrandShipmentId),
  ],
).enableRLS();

export type LogisticsShipment = typeof logisticsShipments.$inferSelect;

/**
 * Logistics shipment items - products in a shipment
 */
export const logisticsShipmentItems = pgTable(
  'logistics_shipment_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shipmentId: uuid('shipment_id')
      .references(() => logisticsShipments.id, { onDelete: 'cascade' })
      .notNull(),

    // Product reference (optional - can be unlinked)
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),

    // Product details (denormalized for independence)
    productName: text('product_name').notNull(),
    lwin: text('lwin'), // LWIN code - unique SKU identifier
    supplierSku: text('supplier_sku'), // Supplier's own reference code (e.g., W-codes from CRURATED)
    producer: text('producer'),
    vintage: integer('vintage'),
    region: text('region'),
    countryOfOrigin: text('country_of_origin'),

    // Customs
    hsCode: text('hs_code'),

    // Quantity
    cases: integer('cases').notNull(),
    bottlesPerCase: integer('bottles_per_case').default(12),
    bottleSizeMl: integer('bottle_size_ml').default(750),
    totalBottles: integer('total_bottles'), // Calculated

    // Weight/dimensions
    grossWeightKg: doublePrecision('gross_weight_kg'),
    netWeightKg: doublePrecision('net_weight_kg'),

    // Value
    declaredValueUsd: doublePrecision('declared_value_usd'),
    productCostPerBottle: doublePrecision('product_cost_per_bottle'),

    // Landed cost allocation (calculated from shipment costs)
    freightAllocated: doublePrecision('freight_allocated'),
    handlingAllocated: doublePrecision('handling_allocated'),
    govFeesAllocated: doublePrecision('gov_fees_allocated'),
    insuranceAllocated: doublePrecision('insurance_allocated'),
    landedCostTotal: doublePrecision('landed_cost_total'),
    landedCostPerBottle: doublePrecision('landed_cost_per_bottle'),

    // Margin analysis
    targetSellingPrice: doublePrecision('target_selling_price'),
    marginPerBottle: doublePrecision('margin_per_bottle'),
    marginPercent: doublePrecision('margin_percent'),

    // Notes
    notes: text('notes'),

    // Sort order
    sortOrder: integer('sort_order').default(0),

    ...timestamps,
  },
  (table) => [
    index('logistics_shipment_items_shipment_id_idx').on(table.shipmentId),
    index('logistics_shipment_items_product_id_idx').on(table.productId),
  ],
).enableRLS();

export type LogisticsShipmentItem = typeof logisticsShipmentItems.$inferSelect;

/**
 * Logistics documents - files attached to shipments
 */
export const logisticsDocuments = pgTable(
  'logistics_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shipmentId: uuid('shipment_id')
      .references(() => logisticsShipments.id, { onDelete: 'cascade' })
      .notNull(),

    // Document type
    documentType: logisticsDocumentType('document_type').notNull(),
    documentNumber: text('document_number'), // Reference number on document

    // File storage
    fileUrl: text('file_url').notNull(),
    fileName: text('file_name').notNull(),
    fileSize: integer('file_size'),
    mimeType: text('mime_type'),

    // Document dates
    issueDate: timestamp('issue_date', { mode: 'date' }),
    expiryDate: timestamp('expiry_date', { mode: 'date' }),

    // Requirements
    isRequired: boolean('is_required').notNull().default(false),
    isVerified: boolean('is_verified').notNull().default(false),
    verifiedBy: uuid('verified_by').references(() => users.id, { onDelete: 'set null' }),
    verifiedAt: timestamp('verified_at', { mode: 'date' }),

    // Upload info (nullable for system-imported documents like Hillebrand sync)
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    uploadedAt: timestamp('uploaded_at', { mode: 'date' }).notNull().defaultNow(),

    // Hillebrand integration
    hillebrandDocumentId: integer('hillebrand_document_id').unique(),
    hillebrandDownloadUrl: text('hillebrand_download_url'),
    hillebrandLastSync: timestamp('hillebrand_last_sync', { mode: 'date' }),

    // AI extraction
    extractionStatus: documentExtractionStatus('extraction_status')
      .notNull()
      .default('pending'),
    extractedData: jsonb('extracted_data').$type<{
      // BOL/AWB fields
      bolNumber?: string;
      awbNumber?: string;
      vesselName?: string;
      voyageNumber?: string;
      portOfLoading?: string;
      portOfDischarge?: string;
      // Invoice fields
      invoiceNumber?: string;
      invoiceDate?: string;
      totalAmount?: number;
      currency?: string;
      // Line items
      lineItems?: Array<{
        productName?: string;
        quantity?: number;
        cases?: number;
        unitPrice?: number;
        total?: number;
        hsCode?: string;
      }>;
      // Other
      rawText?: string;
    }>(),
    extractionError: text('extraction_error'),
    extractedAt: timestamp('extracted_at', { mode: 'date' }),

    // Version tracking (for document updates)
    version: integer('version').notNull().default(1),
    previousVersionId: uuid('previous_version_id'),

    // Notes
    notes: text('notes'),

    ...timestamps,
  },
  (table) => [
    index('logistics_documents_shipment_id_idx').on(table.shipmentId),
    index('logistics_documents_document_type_idx').on(table.documentType),
    index('logistics_documents_extraction_status_idx').on(table.extractionStatus),
    index('logistics_documents_expiry_date_idx').on(table.expiryDate),
  ],
).enableRLS();

export type LogisticsDocument = typeof logisticsDocuments.$inferSelect;

/**
 * Invoice status for Hillebrand invoices
 */
export const logisticsInvoiceStatus = pgEnum('logistics_invoice_status', [
  'open',
  'paid',
  'overdue',
  'disputed',
  'cancelled',
]);

/**
 * Logistics invoices - invoices from Hillebrand
 */
export const logisticsInvoices = pgTable(
  'logistics_invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Hillebrand integration
    hillebrandInvoiceId: integer('hillebrand_invoice_id').unique(),
    hillebrandLastSync: timestamp('hillebrand_last_sync', { mode: 'date' }),

    // Invoice details
    invoiceNumber: text('invoice_number').notNull(),
    invoiceDate: timestamp('invoice_date', { mode: 'date' }).notNull(),
    paymentDueDate: timestamp('payment_due_date', { mode: 'date' }),
    status: logisticsInvoiceStatus('status').notNull().default('open'),

    // Amounts
    currencyCode: text('currency_code').notNull().default('USD'),
    totalAmount: doublePrecision('total_amount').notNull(),
    openAmount: doublePrecision('open_amount').notNull(),
    paidAmount: doublePrecision('paid_amount').default(0),

    // Payment tracking
    paidAt: timestamp('paid_at', { mode: 'date' }),
    paymentReference: text('payment_reference'),

    // Notes
    notes: text('notes'),

    ...timestamps,
  },
  (table) => [
    index('logistics_invoices_invoice_number_idx').on(table.invoiceNumber),
    index('logistics_invoices_status_idx').on(table.status),
    index('logistics_invoices_hillebrand_id_idx').on(table.hillebrandInvoiceId),
    index('logistics_invoices_invoice_date_idx').on(table.invoiceDate),
  ],
).enableRLS();

export type LogisticsInvoice = typeof logisticsInvoices.$inferSelect;

/**
 * Invoice to shipment linkage - one invoice can cover multiple shipments
 */
export const logisticsInvoiceShipments = pgTable(
  'logistics_invoice_shipments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id')
      .references(() => logisticsInvoices.id, { onDelete: 'cascade' })
      .notNull(),
    shipmentId: uuid('shipment_id')
      .references(() => logisticsShipments.id, { onDelete: 'cascade' })
      .notNull(),

    // Optional: portion of invoice allocated to this shipment
    allocatedAmount: doublePrecision('allocated_amount'),

    ...timestamps,
  },
  (table) => [
    index('logistics_invoice_shipments_invoice_id_idx').on(table.invoiceId),
    index('logistics_invoice_shipments_shipment_id_idx').on(table.shipmentId),
  ],
).enableRLS();

export type LogisticsInvoiceShipment = typeof logisticsInvoiceShipments.$inferSelect;

/**
 * Logistics shipment activity logs - audit trail
 */
export const logisticsShipmentActivityLogs = pgTable(
  'logistics_shipment_activity_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shipmentId: uuid('shipment_id')
      .references(() => logisticsShipments.id, { onDelete: 'cascade' })
      .notNull(),

    // Who performed the action
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    partnerId: uuid('partner_id').references(() => partners.id, { onDelete: 'set null' }),

    // Action details
    action: text('action').notNull(), // e.g., 'status_changed', 'document_uploaded', 'cost_updated'
    previousStatus: logisticsShipmentStatus('previous_status'),
    newStatus: logisticsShipmentStatus('new_status'),

    // Additional context
    metadata: jsonb('metadata').$type<{
      documentId?: string;
      documentType?: string;
      costField?: string;
      previousValue?: string | number;
      newValue?: string | number;
      hillebrandEvent?: string;
      [key: string]: unknown;
    }>(),
    notes: text('notes'),

    // Request info
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),

    ...timestamps,
  },
  (table) => [
    index('logistics_shipment_activity_logs_shipment_id_idx').on(table.shipmentId),
    index('logistics_shipment_activity_logs_user_id_idx').on(table.userId),
    index('logistics_shipment_activity_logs_created_at_idx').on(table.createdAt),
    index('logistics_shipment_activity_logs_action_idx').on(table.action),
  ],
).enableRLS();

export type LogisticsShipmentActivityLog = typeof logisticsShipmentActivityLogs.$inferSelect;

/**
 * Logistics rate cards - predefined rates for common routes (e.g., RAK Port fees)
 */
export const logisticsRateCards = pgTable(
  'logistics_rate_cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Rate identification
    name: text('name').notNull(), // e.g., "RAK Port Destuffing FCL"
    description: text('description'),

    // Applicability
    transportMode: logisticsTransportMode('transport_mode'),
    originCountry: text('origin_country'),
    destinationWarehouse: text('destination_warehouse'), // e.g., "RAK Port"

    // Rate details
    rateType: text('rate_type').notNull(), // 'per_container', 'per_case', 'per_kg', 'flat'
    rateAmountAed: doublePrecision('rate_amount_aed').notNull(),
    rateAmountUsd: doublePrecision('rate_amount_usd'),
    currency: text('currency').notNull().default('AED'),

    // Container size specifics (for per_container rates)
    containerSize: text('container_size'), // '20', '40', '40HC'

    // Validity
    validFrom: timestamp('valid_from', { mode: 'date' }),
    validTo: timestamp('valid_to', { mode: 'date' }),
    isActive: boolean('is_active').notNull().default(true),

    // Audit
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (table) => [
    index('logistics_rate_cards_transport_mode_idx').on(table.transportMode),
    index('logistics_rate_cards_destination_warehouse_idx').on(table.destinationWarehouse),
    index('logistics_rate_cards_is_active_idx').on(table.isActive),
  ],
).enableRLS();

export type LogisticsRateCard = typeof logisticsRateCards.$inferSelect;

/**
 * Freight quote status for tracking quote lifecycle
 */
export const logisticsQuoteStatus = pgEnum('logistics_quote_status', [
  'draft',
  'pending',
  'accepted',
  'rejected',
  'expired',
]);

/**
 * Logistics freight quotes - quotes from forwarders for shipments
 */
export const logisticsQuotes = pgTable(
  'logistics_quotes',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Reference number
    quoteNumber: text('quote_number').notNull().unique(),

    // Forwarder info
    forwarderName: text('forwarder_name').notNull(),
    forwarderContact: text('forwarder_contact'),
    forwarderEmail: text('forwarder_email'),

    // Optional link to shipment
    shipmentId: uuid('shipment_id').references(() => logisticsShipments.id, {
      onDelete: 'set null',
    }),

    // Optional link to quote request (forward reference, relation defined separately)
    requestId: uuid('request_id'),

    // Route details (for standalone quotes)
    originCountry: text('origin_country'),
    originCity: text('origin_city'),
    destinationCountry: text('destination_country'),
    destinationCity: text('destination_city'),
    transportMode: logisticsTransportMode('transport_mode'),

    // Pricing
    totalPrice: doublePrecision('total_price').notNull(),
    currency: text('currency').notNull().default('USD'),

    // Transit details
    transitDays: integer('transit_days'),

    // Validity
    validFrom: timestamp('valid_from', { mode: 'date' }),
    validUntil: timestamp('valid_until', { mode: 'date' }),

    // Status
    status: logisticsQuoteStatus('status').notNull().default('pending'),

    // Decision tracking
    acceptedAt: timestamp('accepted_at', { mode: 'date' }),
    acceptedBy: uuid('accepted_by').references(() => users.id, { onDelete: 'set null' }),
    rejectedAt: timestamp('rejected_at', { mode: 'date' }),
    rejectedBy: uuid('rejected_by').references(() => users.id, { onDelete: 'set null' }),
    rejectionReason: text('rejection_reason'),

    // Notes
    notes: text('notes'),
    internalNotes: text('internal_notes'),

    // Audit
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (table) => [
    index('logistics_quotes_quote_number_idx').on(table.quoteNumber),
    index('logistics_quotes_shipment_id_idx').on(table.shipmentId),
    index('logistics_quotes_request_id_idx').on(table.requestId),
    index('logistics_quotes_status_idx').on(table.status),
    index('logistics_quotes_forwarder_idx').on(table.forwarderName),
    index('logistics_quotes_valid_until_idx').on(table.validUntil),
  ],
).enableRLS();

export type LogisticsQuote = typeof logisticsQuotes.$inferSelect;

/**
 * Logistics quote line items - detailed cost breakdown for quotes
 */
export const logisticsQuoteLineItems = pgTable(
  'logistics_quote_line_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    quoteId: uuid('quote_id')
      .references(() => logisticsQuotes.id, { onDelete: 'cascade' })
      .notNull(),

    // Cost category
    category: text('category').notNull(), // 'freight', 'handling', 'customs', 'insurance', etc.
    description: text('description').notNull(),

    // Pricing
    unitPrice: doublePrecision('unit_price'),
    quantity: integer('quantity').default(1),
    total: doublePrecision('total').notNull(),

    // Currency (can override quote currency for specific items)
    currency: text('currency'),

    // Sort order
    sortOrder: integer('sort_order').default(0),

    ...timestamps,
  },
  (table) => [index('logistics_quote_line_items_quote_id_idx').on(table.quoteId)],
).enableRLS();

export type LogisticsQuoteLineItem = typeof logisticsQuoteLineItems.$inferSelect;

// ============================================================================
// LOGISTICS QUOTE REQUESTS
// ============================================================================

/**
 * Status for quote requests
 */
export const logisticsQuoteRequestStatus = pgEnum('logistics_quote_request_status', [
  'pending', // Just created, awaiting logistics team
  'in_progress', // Logistics team is working on it
  'quoted', // Quote(s) have been submitted
  'completed', // Request fulfilled and closed
  'cancelled', // Cancelled by requester
]);

/**
 * Priority levels for quote requests
 */
export const logisticsQuoteRequestPriority = pgEnum('logistics_quote_request_priority', [
  'low',
  'normal',
  'high',
  'urgent',
]);

/**
 * Product types for quote requests
 */
export const logisticsProductType = pgEnum('logistics_product_type', [
  'wine',
  'spirits',
  'beer',
  'mixed',
  'other',
]);

/**
 * Logistics quote requests - sales team requests for freight quotes
 *
 * Workflow:
 * 1. Sales creates a quote request with cargo details
 * 2. Logistics team assigns themselves and works on it
 * 3. Logistics team creates quotes (logisticsQuotes) linked to this request
 * 4. Request is marked as quoted/completed
 */
export const logisticsQuoteRequests = pgTable(
  'logistics_quote_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Reference number (QRQ-YYYY-XXXX)
    requestNumber: text('request_number').notNull().unique(),

    // Status & priority
    status: logisticsQuoteRequestStatus('status').notNull().default('pending'),
    priority: logisticsQuoteRequestPriority('priority').notNull().default('normal'),

    // Requester info
    requestedBy: uuid('requested_by')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    requestedAt: timestamp('requested_at', { mode: 'date' }).notNull().defaultNow(),

    // Assignment
    assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    assignedAt: timestamp('assigned_at', { mode: 'date' }),

    // Route details
    originCountry: text('origin_country').notNull(),
    originCity: text('origin_city'),
    originWarehouse: text('origin_warehouse'),
    destinationCountry: text('destination_country').notNull(),
    destinationCity: text('destination_city'),
    destinationWarehouse: text('destination_warehouse'),
    transportMode: logisticsTransportMode('transport_mode'),

    // Cargo details
    productType: logisticsProductType('product_type').notNull().default('wine'),
    productDescription: text('product_description'),
    totalCases: integer('total_cases'),
    totalPallets: integer('total_pallets'),
    totalWeightKg: doublePrecision('total_weight_kg'),
    totalVolumeM3: doublePrecision('total_volume_m3'),

    // Special requirements
    requiresThermalLiner: boolean('requires_thermal_liner').notNull().default(false),
    requiresTracker: boolean('requires_tracker').notNull().default(false),
    requiresInsurance: boolean('requires_insurance').notNull().default(false),
    temperatureControlled: boolean('temperature_controlled').notNull().default(false),
    minTemperature: doublePrecision('min_temperature'), // in Celsius
    maxTemperature: doublePrecision('max_temperature'), // in Celsius

    // Timing
    targetPickupDate: timestamp('target_pickup_date', { mode: 'date' }),
    targetDeliveryDate: timestamp('target_delivery_date', { mode: 'date' }),
    isFlexibleDates: boolean('is_flexible_dates').notNull().default(true),

    // Notes
    notes: text('notes'),
    internalNotes: text('internal_notes'),

    // Completion
    completedAt: timestamp('completed_at', { mode: 'date' }),
    completedBy: uuid('completed_by').references(() => users.id, { onDelete: 'set null' }),
    cancellationReason: text('cancellation_reason'),

    ...timestamps,
  },
  (table) => [
    index('logistics_quote_requests_request_number_idx').on(table.requestNumber),
    index('logistics_quote_requests_status_idx').on(table.status),
    index('logistics_quote_requests_requested_by_idx').on(table.requestedBy),
    index('logistics_quote_requests_assigned_to_idx').on(table.assignedTo),
    index('logistics_quote_requests_priority_idx').on(table.priority),
  ],
).enableRLS();

export type LogisticsQuoteRequest = typeof logisticsQuoteRequests.$inferSelect;

/**
 * Attachments for quote requests - supporting PDFs and documents
 */
export const logisticsQuoteRequestAttachments = pgTable(
  'logistics_quote_request_attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .references(() => logisticsQuoteRequests.id, { onDelete: 'cascade' })
      .notNull(),

    // File details
    fileName: text('file_name').notNull(),
    fileUrl: text('file_url').notNull(),
    fileSize: integer('file_size'),
    mimeType: text('mime_type'),

    // Metadata
    description: text('description'),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    uploadedAt: timestamp('uploaded_at', { mode: 'date' }).notNull().defaultNow(),

    ...timestamps,
  },
  (table) => [index('logistics_quote_request_attachments_request_id_idx').on(table.requestId)],
).enableRLS();

export type LogisticsQuoteRequestAttachment = typeof logisticsQuoteRequestAttachments.$inferSelect;

// ============================================================================
// WINE EXCHANGE TABLES
// B2B marketplace connecting EU suppliers with UAE trade buyers
// ============================================================================

/**
 * Status for supplier products (consigned inventory)
 */
export const supplierProductStatus = pgEnum('supplier_product_status', [
  'incoming', // Shipment in transit to RAK
  'available', // Checked in and available for sale
  'low_stock', // Below threshold
  'sold_out', // No cases remaining
]);

/**
 * Status for exchange orders
 */
export const exchangeOrderStatus = pgEnum('exchange_order_status', [
  'pending', // Order placed, awaiting confirmation
  'confirmed', // Stock reserved
  'paid', // Payment received
  'picking', // Being picked at warehouse
  'shipped', // Out for delivery
  'delivered', // Completed
  'cancelled', // Cancelled
]);

/**
 * Status for supplier payouts
 */
export const supplierPayoutStatus = pgEnum('supplier_payout_status', [
  'pending', // Awaiting processing
  'processing', // Being processed
  'paid', // Completed
]);

/**
 * Status for supplier shipments (inbound to RAK)
 */
export const supplierShipmentStatus = pgEnum('supplier_shipment_status', [
  'draft', // Being prepared
  'submitted', // Manifest sent
  'in_transit', // Shipped
  'arrived', // At port/warehouse
  'checked_in', // Verified and added to inventory
  'issues', // Problems identified
]);

/**
 * Supplier products - consigned inventory from suppliers (partners with type='supplier')
 * Links suppliers to products with pricing and availability
 */
export const supplierProducts = pgTable(
  'supplier_products',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Supplier (partner with type='supplier')
    supplierId: uuid('supplier_id')
      .references(() => partners.id, { onDelete: 'cascade' })
      .notNull(),

    // Product reference
    productId: uuid('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),

    // Supplier's own SKU/reference
    supplierSku: text('supplier_sku'),

    // Pricing (supplier's cost in EUR)
    costPriceEur: doublePrecision('cost_price_eur').notNull(),

    // Inventory tracking
    casesConsigned: integer('cases_consigned').notNull().default(0),
    casesAvailable: integer('cases_available').notNull().default(0),
    casesSold: integer('cases_sold').notNull().default(0),
    casesReserved: integer('cases_reserved').notNull().default(0),

    // Status
    status: supplierProductStatus('status').notNull().default('incoming'),

    // Low stock threshold
    lowStockThreshold: integer('low_stock_threshold').default(3),

    // Notes
    notes: text('notes'),

    ...timestamps,
  },
  (table) => [
    index('supplier_products_supplier_id_idx').on(table.supplierId),
    index('supplier_products_product_id_idx').on(table.productId),
    index('supplier_products_status_idx').on(table.status),
  ],
).enableRLS();

export type SupplierProduct = typeof supplierProducts.$inferSelect;

/**
 * Exchange orders - orders placed by trade buyers on the exchange
 */
export const exchangeOrders = pgTable(
  'exchange_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Order reference (EXC-YYYY-XXXX)
    orderNumber: text('order_number').notNull().unique(),

    // Buyer (partner - can be retailer, distributor, etc.)
    buyerId: uuid('buyer_id')
      .references(() => partners.id, { onDelete: 'restrict' })
      .notNull(),

    // User who placed the order
    placedBy: uuid('placed_by')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),

    // Status
    status: exchangeOrderStatus('status').notNull().default('pending'),

    // Financials (USD)
    subtotalUsd: doublePrecision('subtotal_usd').notNull().default(0),
    deliveryFeeUsd: doublePrecision('delivery_fee_usd').notNull().default(0),
    totalUsd: doublePrecision('total_usd').notNull().default(0),

    // Delivery details
    deliveryAddress: text('delivery_address'),
    deliveryNotes: text('delivery_notes'),

    // Order notes
    buyerNotes: text('buyer_notes'),
    internalNotes: text('internal_notes'),

    // Timestamps
    placedAt: timestamp('placed_at', { mode: 'date' }).notNull().defaultNow(),
    confirmedAt: timestamp('confirmed_at', { mode: 'date' }),
    paidAt: timestamp('paid_at', { mode: 'date' }),
    shippedAt: timestamp('shipped_at', { mode: 'date' }),
    deliveredAt: timestamp('delivered_at', { mode: 'date' }),
    cancelledAt: timestamp('cancelled_at', { mode: 'date' }),
    cancellationReason: text('cancellation_reason'),

    ...timestamps,
  },
  (table) => [
    index('exchange_orders_order_number_idx').on(table.orderNumber),
    index('exchange_orders_buyer_id_idx').on(table.buyerId),
    index('exchange_orders_status_idx').on(table.status),
    index('exchange_orders_placed_at_idx').on(table.placedAt),
  ],
).enableRLS();

export type ExchangeOrder = typeof exchangeOrders.$inferSelect;

/**
 * Exchange order items - line items in exchange orders
 * Tracks which supplier product was purchased
 */
export const exchangeOrderItems = pgTable(
  'exchange_order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Order reference
    orderId: uuid('order_id')
      .references(() => exchangeOrders.id, { onDelete: 'cascade' })
      .notNull(),

    // Supplier product reference
    supplierProductId: uuid('supplier_product_id')
      .references(() => supplierProducts.id, { onDelete: 'restrict' })
      .notNull(),

    // Supplier reference (denormalized for reporting)
    supplierId: uuid('supplier_id')
      .references(() => partners.id, { onDelete: 'restrict' })
      .notNull(),

    // Quantity
    quantity: integer('quantity').notNull(),

    // Pricing at time of order (USD)
    unitPriceUsd: doublePrecision('unit_price_usd').notNull(),
    lineTotalUsd: doublePrecision('line_total_usd').notNull(),

    // Supplier's cost at time of order (EUR for settlement)
    supplierCostEur: doublePrecision('supplier_cost_eur').notNull(),

    // Product details (denormalized for order history)
    productName: text('product_name').notNull(),
    productVintage: text('product_vintage'),
    productRegion: text('product_region'),
    caseSize: integer('case_size').notNull(),
    bottleSize: integer('bottle_size').notNull(),

    ...timestamps,
  },
  (table) => [
    index('exchange_order_items_order_id_idx').on(table.orderId),
    index('exchange_order_items_supplier_product_id_idx').on(table.supplierProductId),
    index('exchange_order_items_supplier_id_idx').on(table.supplierId),
  ],
).enableRLS();

export type ExchangeOrderItem = typeof exchangeOrderItems.$inferSelect;

/**
 * Supplier payouts - monthly settlement records for suppliers
 */
export const supplierPayouts = pgTable(
  'supplier_payouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Payout reference (PAY-YYYY-MM-XXXX)
    payoutNumber: text('payout_number').notNull().unique(),

    // Supplier
    supplierId: uuid('supplier_id')
      .references(() => partners.id, { onDelete: 'restrict' })
      .notNull(),

    // Period
    periodStart: timestamp('period_start', { mode: 'date' }).notNull(),
    periodEnd: timestamp('period_end', { mode: 'date' }).notNull(),

    // Financials (EUR)
    grossSalesEur: doublePrecision('gross_sales_eur').notNull().default(0),
    commissionEur: doublePrecision('commission_eur').notNull().default(0),
    commissionRate: doublePrecision('commission_rate').notNull(), // Rate at time of payout
    netPayoutEur: doublePrecision('net_payout_eur').notNull().default(0),

    // Order count for this period
    orderCount: integer('order_count').notNull().default(0),
    itemCount: integer('item_count').notNull().default(0),

    // Status
    status: supplierPayoutStatus('status').notNull().default('pending'),

    // Payment details
    paidAt: timestamp('paid_at', { mode: 'date' }),
    paymentReference: text('payment_reference'),
    processedBy: uuid('processed_by').references(() => users.id, { onDelete: 'set null' }),

    // Notes
    notes: text('notes'),

    ...timestamps,
  },
  (table) => [
    index('supplier_payouts_payout_number_idx').on(table.payoutNumber),
    index('supplier_payouts_supplier_id_idx').on(table.supplierId),
    index('supplier_payouts_status_idx').on(table.status),
    index('supplier_payouts_period_idx').on(table.periodStart, table.periodEnd),
  ],
).enableRLS();

export type SupplierPayout = typeof supplierPayouts.$inferSelect;

/**
 * Supplier shipments - inbound shipments from suppliers to RAK warehouse
 */
export const supplierShipments = pgTable(
  'supplier_shipments',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Shipment reference (SHP-YYYY-XXXX)
    shipmentNumber: text('shipment_number').notNull().unique(),

    // Supplier
    supplierId: uuid('supplier_id')
      .references(() => partners.id, { onDelete: 'restrict' })
      .notNull(),

    // Status
    status: supplierShipmentStatus('status').notNull().default('draft'),

    // Tracking
    trackingNumber: text('tracking_number'),
    carrier: text('carrier'),

    // Dates
    expectedArrival: timestamp('expected_arrival', { mode: 'date' }),
    actualArrival: timestamp('actual_arrival', { mode: 'date' }),
    checkedInAt: timestamp('checked_in_at', { mode: 'date' }),
    checkedInBy: uuid('checked_in_by').references(() => users.id, { onDelete: 'set null' }),

    // Totals
    totalCases: integer('total_cases').notNull().default(0),
    totalProducts: integer('total_products').notNull().default(0),

    // Notes
    notes: text('notes'),
    issueNotes: text('issue_notes'),

    ...timestamps,
  },
  (table) => [
    index('supplier_shipments_shipment_number_idx').on(table.shipmentNumber),
    index('supplier_shipments_supplier_id_idx').on(table.supplierId),
    index('supplier_shipments_status_idx').on(table.status),
  ],
).enableRLS();

export type SupplierShipment = typeof supplierShipments.$inferSelect;

/**
 * Supplier shipment items - products in an inbound shipment
 */
export const supplierShipmentItems = pgTable(
  'supplier_shipment_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Shipment reference
    shipmentId: uuid('shipment_id')
      .references(() => supplierShipments.id, { onDelete: 'cascade' })
      .notNull(),

    // Product reference (optional - may be created during check-in)
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),

    // Supplier product (created/updated on check-in)
    supplierProductId: uuid('supplier_product_id').references(() => supplierProducts.id, {
      onDelete: 'set null',
    }),

    // Product details from manifest
    productName: text('product_name').notNull(),
    producer: text('producer'),
    vintage: text('vintage'),
    region: text('region'),
    country: text('country'),
    caseSize: integer('case_size').notNull().default(12),
    bottleSize: integer('bottle_size').notNull().default(750),

    // Quantity
    casesExpected: integer('cases_expected').notNull(),
    casesReceived: integer('cases_received'),

    // Pricing (EUR)
    costPriceEur: doublePrecision('cost_price_eur').notNull(),

    // LWIN matching
    lwin7: text('lwin7'),
    lwin11: text('lwin11'),
    matchConfidence: doublePrecision('match_confidence'),

    // Notes
    notes: text('notes'),

    ...timestamps,
  },
  (table) => [
    index('supplier_shipment_items_shipment_id_idx').on(table.shipmentId),
    index('supplier_shipment_items_product_id_idx').on(table.productId),
  ],
).enableRLS();

export type SupplierShipmentItem = typeof supplierShipmentItems.$inferSelect;

// ============================================================================
// WMS (Warehouse Management System)
// ============================================================================

export const wmsLocationType = pgEnum('wms_location_type', [
  'rack',
  'floor',
  'receiving',
  'shipping',
]);

export const wmsStorageMethod = pgEnum('wms_storage_method', [
  'pallet', // Full pallet locations - pick entire pallets
  'shelf', // Shelf locations - pick individual cases
  'mixed', // Can store either
]);

export const wmsMovementType = pgEnum('wms_movement_type', [
  'receive',
  'putaway',
  'transfer',
  'pick',
  'adjust',
  'count',
  'ownership_transfer',
  'repack_out',
  'repack_in',
  'pallet_add',
  'pallet_remove',
  'pallet_move',
  'pallet_unseal',
  'pallet_dissolve',
  'pallet_dispatch',
  'dispatch',
]);

export const wmsReservationStatus = pgEnum('wms_reservation_status', [
  'active',
  'picked',
  'released',
]);

export const wmsCycleCountStatus = pgEnum('wms_cycle_count_status', [
  'pending',
  'in_progress',
  'completed',
  'reconciled',
]);

export const wmsPickListStatus = pgEnum('wms_pick_list_status', [
  'pending',
  'in_progress',
  'completed',
  'cancelled',
]);

export const wmsDispatchBatchStatus = pgEnum('wms_dispatch_batch_status', [
  'draft',
  'picking',
  'staged',
  'dispatched',
  'delivered',
]);

export const wmsPalletStatus = pgEnum('wms_pallet_status', [
  'active',
  'sealed',
  'retrieved',
  'archived',
]);

export const wmsRequestType = pgEnum('wms_request_type', [
  'transfer',
  'mark_for_sale',
  'withdrawal',
]);

export const wmsRequestStatus = pgEnum('wms_request_status', [
  'pending',
  'approved',
  'rejected',
  'completed',
]);

export const settlementStatus = pgEnum('settlement_status', [
  'pending',
  'payment_received',
  'settled',
]);

/**
 * WMS Locations - warehouse bin locations
 */
export const wmsLocations = pgTable(
  'wms_locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    locationCode: text('location_code').notNull().unique(),
    aisle: text('aisle').notNull(),
    bay: text('bay').notNull(),
    level: text('level').notNull(),
    locationType: wmsLocationType('location_type').notNull(),
    storageMethod: wmsStorageMethod('storage_method').default('shelf'),
    position: text('position'), // Optional sub-position (e.g., 'L', 'R', '01', '02')
    capacityCases: integer('capacity_cases'),
    requiresForklift: boolean('requires_forklift').default(false),
    isActive: boolean('is_active').default(true),
    barcode: text('barcode').notNull().unique(),
    notes: text('notes'),
    ...timestamps,
  },
  (table) => [
    index('wms_locations_aisle_idx').on(table.aisle),
    index('wms_locations_location_type_idx').on(table.locationType),
    index('wms_locations_barcode_idx').on(table.barcode),
  ],
);

export type WmsLocation = typeof wmsLocations.$inferSelect;

/**
 * WMS Stock - stock by location with multi-owner support
 */
export const wmsStock = pgTable(
  'wms_stock',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    locationId: uuid('location_id')
      .references(() => wmsLocations.id)
      .notNull(),
    ownerId: uuid('owner_id')
      .references(() => partners.id)
      .notNull(),
    ownerName: text('owner_name').notNull(),
    lwin18: text('lwin18').notNull(),
    supplierSku: text('supplier_sku'), // Supplier's own reference code (e.g., W-codes from CRURATED)
    productName: text('product_name').notNull(),
    producer: text('producer'),
    vintage: integer('vintage'),
    bottleSize: text('bottle_size').default('750ml'),
    caseConfig: integer('case_config').default(12),
    quantityCases: integer('quantity_cases').notNull().default(0),
    reservedCases: integer('reserved_cases').notNull().default(0),
    availableCases: integer('available_cases').notNull().default(0),
    lotNumber: text('lot_number'),
    receivedAt: timestamp('received_at', { mode: 'date' }),
    shipmentId: uuid('shipment_id').references(() => logisticsShipments.id),
    salesArrangement: text('sales_arrangement').default('consignment'),
    consignmentCommissionPercent: doublePrecision('consignment_commission_percent'),
    expiryDate: timestamp('expiry_date', { mode: 'date' }),
    isPerishable: boolean('is_perishable').default(false),
    notes: text('notes'),
    ...timestamps,
  },
  (table) => [
    index('wms_stock_location_id_idx').on(table.locationId),
    index('wms_stock_owner_id_idx').on(table.ownerId),
    index('wms_stock_lwin18_idx').on(table.lwin18),
    index('wms_stock_shipment_id_idx').on(table.shipmentId),
    index('wms_stock_lwin18_location_owner_idx').on(
      table.lwin18,
      table.locationId,
      table.ownerId,
    ),
    // Prevent duplicate stock records for same product at same location from same shipment
    uniqueIndex('wms_stock_lwin18_location_shipment_unique').on(
      table.lwin18,
      table.locationId,
      table.shipmentId,
    ),
  ],
);

export type WmsStock = typeof wmsStock.$inferSelect;

/**
 * WMS Stock Movements - audit trail for all stock movements
 */
export const wmsStockMovements = pgTable(
  'wms_stock_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    movementNumber: text('movement_number').notNull().unique(),
    movementType: wmsMovementType('movement_type').notNull(),
    lwin18: text('lwin18').notNull(),
    supplierSku: text('supplier_sku'), // Supplier's own reference code
    productName: text('product_name').notNull(),
    quantityCases: integer('quantity_cases').notNull(),
    fromLocationId: uuid('from_location_id').references(() => wmsLocations.id),
    toLocationId: uuid('to_location_id').references(() => wmsLocations.id),
    fromOwnerId: uuid('from_owner_id').references(() => partners.id),
    toOwnerId: uuid('to_owner_id').references(() => partners.id),
    lotNumber: text('lot_number'),
    shipmentId: uuid('shipment_id').references(() => logisticsShipments.id),
    orderId: uuid('order_id'),
    scannedBarcodes: jsonb('scanned_barcodes').$type<string[]>(),
    notes: text('notes'),
    reasonCode: text('reason_code'),
    performedBy: uuid('performed_by')
      .references(() => users.id)
      .notNull(),
    performedAt: timestamp('performed_at', { mode: 'date' }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => [
    index('wms_stock_movements_movement_type_idx').on(table.movementType),
    index('wms_stock_movements_lwin18_idx').on(table.lwin18),
    index('wms_stock_movements_performed_at_idx').on(table.performedAt),
  ],
);

export type WmsStockMovement = typeof wmsStockMovements.$inferSelect;

/**
 * WMS Stock Reservations - track stock reserved for confirmed orders
 */
export const wmsStockReservations = pgTable(
  'wms_stock_reservations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    stockId: uuid('stock_id')
      .references(() => wmsStock.id)
      .notNull(),
    orderType: text('order_type').notNull(), // 'zoho' | 'pco'
    orderId: uuid('order_id').notNull(),
    orderItemId: uuid('order_item_id').notNull(),
    orderNumber: text('order_number').notNull(),
    lwin18: text('lwin18').notNull(),
    productName: text('product_name').notNull(),
    quantityCases: integer('quantity_cases').notNull(),
    status: wmsReservationStatus('status').notNull().default('active'),
    releasedAt: timestamp('released_at', { mode: 'date' }),
    releaseReason: text('release_reason'),
    pickedAt: timestamp('picked_at', { mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    index('wms_stock_reservations_stock_id_idx').on(table.stockId),
    index('wms_stock_reservations_order_id_idx').on(table.orderId),
    index('wms_stock_reservations_order_item_id_idx').on(table.orderItemId),
    index('wms_stock_reservations_status_idx').on(table.status),
    index('wms_stock_reservations_order_type_idx').on(table.orderType),
  ],
);

export type WmsStockReservation = typeof wmsStockReservations.$inferSelect;

/**
 * WMS Case Labels - individual case barcode tracking
 */
export const wmsCaseLabels = pgTable(
  'wms_case_labels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    barcode: text('barcode').notNull().unique(),
    lwin18: text('lwin18').notNull(),
    productName: text('product_name').notNull(),
    lotNumber: text('lot_number'),
    shipmentId: uuid('shipment_id').references(() => logisticsShipments.id),
    currentLocationId: uuid('current_location_id').references(() => wmsLocations.id),
    isActive: boolean('is_active').default(true),
    printedAt: timestamp('printed_at', { mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    index('wms_case_labels_barcode_idx').on(table.barcode),
    index('wms_case_labels_lwin18_idx').on(table.lwin18),
    index('wms_case_labels_current_location_id_idx').on(table.currentLocationId),
  ],
);

export type WmsCaseLabel = typeof wmsCaseLabels.$inferSelect;

/**
 * WMS Cycle Counts - inventory counting
 */
export const wmsCycleCounts = pgTable(
  'wms_cycle_counts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    countNumber: text('count_number').notNull().unique(),
    locationId: uuid('location_id').references(() => wmsLocations.id),
    status: wmsCycleCountStatus('status').default('pending'),
    expectedItems: integer('expected_items').default(0),
    countedItems: integer('counted_items').default(0),
    discrepancyCount: integer('discrepancy_count').default(0),
    createdBy: uuid('created_by').references(() => users.id),
    completedAt: timestamp('completed_at', { mode: 'date' }),
    notes: text('notes'),
    ...timestamps,
  },
  (table) => [
    index('wms_cycle_counts_location_id_idx').on(table.locationId),
    index('wms_cycle_counts_status_idx').on(table.status),
  ],
);

export type WmsCycleCount = typeof wmsCycleCounts.$inferSelect;

/**
 * WMS Cycle Count Items - individual stock items tracked during a cycle count
 */
export const wmsCycleCountItems = pgTable(
  'wms_cycle_count_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cycleCountId: uuid('cycle_count_id')
      .notNull()
      .references(() => wmsCycleCounts.id),
    stockId: uuid('stock_id').references(() => wmsStock.id),
    locationId: uuid('location_id')
      .notNull()
      .references(() => wmsLocations.id),
    lwin18: text('lwin18').notNull(),
    productName: text('product_name').notNull(),
    expectedQuantity: integer('expected_quantity').notNull().default(0),
    countedQuantity: integer('counted_quantity'),
    discrepancy: integer('discrepancy'),
    notes: text('notes'),
    countedAt: timestamp('counted_at', { mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    index('wms_cycle_count_items_count_id_idx').on(table.cycleCountId),
  ],
);

export type WmsCycleCountItem = typeof wmsCycleCountItems.$inferSelect;

/**
 * WMS Repacks - case splitting/repacking tracking
 */
export const wmsRepacks = pgTable(
  'wms_repacks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    repackNumber: text('repack_number').notNull().unique(),
    sourceLwin18: text('source_lwin18').notNull(),
    sourceProductName: text('source_product_name').notNull(),
    sourceCaseConfig: integer('source_case_config').notNull(),
    sourceQuantityCases: integer('source_quantity_cases').notNull(),
    sourceStockId: uuid('source_stock_id').references(() => wmsStock.id),
    targetLwin18: text('target_lwin18').notNull(),
    targetProductName: text('target_product_name').notNull(),
    targetCaseConfig: integer('target_case_config').notNull(),
    targetQuantityCases: integer('target_quantity_cases').notNull(),
    targetStockId: uuid('target_stock_id').references(() => wmsStock.id),
    locationId: uuid('location_id')
      .references(() => wmsLocations.id)
      .notNull(),
    ownerId: uuid('owner_id')
      .references(() => partners.id)
      .notNull(),
    performedBy: uuid('performed_by')
      .references(() => users.id)
      .notNull(),
    performedAt: timestamp('performed_at', { mode: 'date' }).notNull().defaultNow(),
    notes: text('notes'),
    ...timestamps,
  },
  (table) => [
    index('wms_repacks_location_id_idx').on(table.locationId),
    index('wms_repacks_owner_id_idx').on(table.ownerId),
  ],
);

export type WmsRepack = typeof wmsRepacks.$inferSelect;

/**
 * WMS Pick Lists - order picking
 */
export const wmsPickLists = pgTable(
  'wms_pick_lists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pickListNumber: text('pick_list_number').notNull().unique(),
    status: wmsPickListStatus('status').default('pending'),
    orderId: uuid('order_id').notNull(),
    orderNumber: text('order_number').notNull(),
    totalItems: integer('total_items').notNull().default(0),
    pickedItems: integer('picked_items').notNull().default(0),
    assignedTo: uuid('assigned_to').references(() => users.id),
    startedAt: timestamp('started_at', { mode: 'date' }),
    completedAt: timestamp('completed_at', { mode: 'date' }),
    completedBy: uuid('completed_by').references(() => users.id),
    notes: text('notes'),
    ...timestamps,
  },
  (table) => [
    index('wms_pick_lists_status_idx').on(table.status),
    index('wms_pick_lists_order_id_idx').on(table.orderId),
  ],
);

export type WmsPickList = typeof wmsPickLists.$inferSelect;

/**
 * WMS Pick List Items - individual items to pick
 */
export const wmsPickListItems = pgTable(
  'wms_pick_list_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pickListId: uuid('pick_list_id')
      .references(() => wmsPickLists.id)
      .notNull(),
    lwin18: text('lwin18').notNull(),
    productName: text('product_name').notNull(),
    quantityCases: integer('quantity_cases').notNull(),
    suggestedLocationId: uuid('suggested_location_id').references(() => wmsLocations.id),
    suggestedStockId: uuid('suggested_stock_id').references(() => wmsStock.id),
    pickedFromLocationId: uuid('picked_from_location_id').references(() => wmsLocations.id),
    pickedQuantity: integer('picked_quantity'),
    pickedAt: timestamp('picked_at', { mode: 'date' }),
    pickedBy: uuid('picked_by').references(() => users.id),
    isPicked: boolean('is_picked').default(false),
    notes: text('notes'),
    ...timestamps,
  },
  (table) => [index('wms_pick_list_items_pick_list_id_idx').on(table.pickListId)],
);

export type WmsPickListItem = typeof wmsPickListItems.$inferSelect;

/**
 * WMS Dispatch Batches - pallet batching for distributors
 */
export const wmsDispatchBatches = pgTable(
  'wms_dispatch_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchNumber: text('batch_number').notNull().unique(),
    status: wmsDispatchBatchStatus('status').default('draft'),
    distributorId: uuid('distributor_id')
      .references(() => partners.id)
      .notNull(),
    distributorName: text('distributor_name').notNull(),
    orderCount: integer('order_count').notNull().default(0),
    totalCases: integer('total_cases').notNull().default(0),
    palletCount: integer('pallet_count').default(1),
    estimatedWeightKg: doublePrecision('estimated_weight_kg'),
    deliveryNotes: text('delivery_notes'),
    pickListId: uuid('pick_list_id').references(() => wmsPickLists.id),
    dispatchedAt: timestamp('dispatched_at', { mode: 'date' }),
    dispatchedBy: uuid('dispatched_by').references(() => users.id),
    deliveredAt: timestamp('delivered_at', { mode: 'date' }),
    notes: text('notes'),
    ...timestamps,
  },
  (table) => [
    index('wms_dispatch_batches_status_idx').on(table.status),
    index('wms_dispatch_batches_distributor_id_idx').on(table.distributorId),
  ],
);

export type WmsDispatchBatch = typeof wmsDispatchBatches.$inferSelect;

/**
 * WMS Delivery Notes - delivery documentation
 */
export const wmsDeliveryNotes = pgTable(
  'wms_delivery_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deliveryNoteNumber: text('delivery_note_number').notNull().unique(),
    batchId: uuid('batch_id')
      .references(() => wmsDispatchBatches.id)
      .notNull(),
    orderCount: integer('order_count').notNull().default(0),
    totalCases: integer('total_cases').notNull().default(0),
    generatedAt: timestamp('generated_at', { mode: 'date' }).notNull().defaultNow(),
    generatedBy: uuid('generated_by')
      .references(() => users.id)
      .notNull(),
    pdfUrl: text('pdf_url'),
    notes: text('notes'),
    ...timestamps,
  },
  (table) => [index('wms_delivery_notes_batch_id_idx').on(table.batchId)],
);

export type WmsDeliveryNote = typeof wmsDeliveryNotes.$inferSelect;

/**
 * WMS Dispatch Batch Orders - orders in a batch
 */
export const wmsDispatchBatchOrders = pgTable(
  'wms_dispatch_batch_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchId: uuid('batch_id')
      .references(() => wmsDispatchBatches.id)
      .notNull(),
    orderId: uuid('order_id').notNull(),
    orderNumber: text('order_number').notNull(),
    addedAt: timestamp('added_at', { mode: 'date' }).notNull().defaultNow(),
    deliveryNoteId: uuid('delivery_note_id').references(() => wmsDeliveryNotes.id),
    ...timestamps,
  },
  (table) => [
    index('wms_dispatch_batch_orders_batch_id_idx').on(table.batchId),
    index('wms_dispatch_batch_orders_order_id_idx').on(table.orderId),
  ],
);

export type WmsDispatchBatchOrder = typeof wmsDispatchBatchOrders.$inferSelect;

/**
 * WMS Pallets - customer storage pallets
 */
export const wmsPallets = pgTable(
  'wms_pallets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    palletCode: text('pallet_code').notNull().unique(),
    barcode: text('barcode').notNull().unique(),
    ownerId: uuid('owner_id')
      .references(() => partners.id)
      .notNull(),
    ownerName: text('owner_name').notNull(),
    locationId: uuid('location_id').references(() => wmsLocations.id),
    totalCases: integer('total_cases').notNull().default(0),
    storageType: text('storage_type').default('customer_storage'),
    monthlyStorageFee: doublePrecision('monthly_storage_fee'),
    feeType: text('fee_type').default('per_case'),
    status: wmsPalletStatus('status').default('active'),
    isSealed: boolean('is_sealed').default(false),
    sealedAt: timestamp('sealed_at', { mode: 'date' }),
    sealedBy: uuid('sealed_by').references(() => users.id),
    notes: text('notes'),
    ...timestamps,
  },
  (table) => [
    index('wms_pallets_owner_id_idx').on(table.ownerId),
    index('wms_pallets_location_id_idx').on(table.locationId),
    index('wms_pallets_status_idx').on(table.status),
    index('wms_pallets_barcode_idx').on(table.barcode),
  ],
);

export type WmsPallet = typeof wmsPallets.$inferSelect;

/**
 * WMS Pallet Cases - cases linked to pallets
 */
export const wmsPalletCases = pgTable(
  'wms_pallet_cases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    palletId: uuid('pallet_id')
      .references(() => wmsPallets.id)
      .notNull(),
    caseLabelId: uuid('case_label_id')
      .references(() => wmsCaseLabels.id)
      .notNull(),
    lwin18: text('lwin18').notNull(),
    productName: text('product_name').notNull(),
    addedAt: timestamp('added_at', { mode: 'date' }).notNull().defaultNow(),
    addedBy: uuid('added_by')
      .references(() => users.id)
      .notNull(),
    removedAt: timestamp('removed_at', { mode: 'date' }),
    removedBy: uuid('removed_by').references(() => users.id),
    removalReason: text('removal_reason'),
    ...timestamps,
  },
  (table) => [
    index('wms_pallet_cases_pallet_id_idx').on(table.palletId),
    index('wms_pallet_cases_case_label_id_idx').on(table.caseLabelId),
  ],
);

export type WmsPalletCase = typeof wmsPalletCases.$inferSelect;

/**
 * WMS Storage Charges - storage fee tracking
 */
export const wmsStorageCharges = pgTable(
  'wms_storage_charges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chargeNumber: text('charge_number').notNull().unique(),
    palletId: uuid('pallet_id').references(() => wmsPallets.id),
    ownerId: uuid('owner_id')
      .references(() => partners.id)
      .notNull(),
    ownerName: text('owner_name').notNull(),
    periodStart: timestamp('period_start', { mode: 'date' }).notNull(),
    periodEnd: timestamp('period_end', { mode: 'date' }).notNull(),
    caseCount: integer('case_count').notNull(),
    palletCount: integer('pallet_count').notNull().default(1),
    ratePerUnit: doublePrecision('rate_per_unit').notNull(),
    rateType: text('rate_type').notNull(),
    totalAmount: doublePrecision('total_amount').notNull(),
    currency: text('currency').default('USD'),
    invoiced: boolean('invoiced').default(false),
    zohoInvoiceId: text('zoho_invoice_id'),
    paidAt: timestamp('paid_at', { mode: 'date' }),
    notes: text('notes'),
    ...timestamps,
  },
  (table) => [
    index('wms_storage_charges_owner_id_idx').on(table.ownerId),
    index('wms_storage_charges_pallet_id_idx').on(table.palletId),
  ],
);

export type WmsStorageCharge = typeof wmsStorageCharges.$inferSelect;

/**
 * WMS Partner Requests - partner action requests
 */
export const wmsPartnerRequests = pgTable(
  'wms_partner_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestNumber: text('request_number').notNull().unique(),
    requestType: wmsRequestType('request_type').notNull(),
    status: wmsRequestStatus('status').default('pending'),
    partnerId: uuid('partner_id')
      .references(() => partners.id)
      .notNull(),
    requestedBy: uuid('requested_by')
      .references(() => users.id)
      .notNull(),
    requestedAt: timestamp('requested_at', { mode: 'date' }).notNull().defaultNow(),
    stockId: uuid('stock_id').references(() => wmsStock.id),
    lwin18: text('lwin18').notNull(),
    productName: text('product_name').notNull(),
    quantityCases: integer('quantity_cases').notNull(),
    targetLocationId: uuid('target_location_id').references(() => wmsLocations.id),
    partnerNotes: text('partner_notes'),
    adminNotes: text('admin_notes'),
    resolvedBy: uuid('resolved_by').references(() => users.id),
    resolvedAt: timestamp('resolved_at', { mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    index('wms_partner_requests_partner_id_idx').on(table.partnerId),
    index('wms_partner_requests_status_idx').on(table.status),
  ],
);

export type WmsPartnerRequest = typeof wmsPartnerRequests.$inferSelect;

/**
 * Consignment Settlements - tracking payments to stock owners
 */
export const consignmentSettlements = pgTable(
  'consignment_settlements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    settlementNumber: text('settlement_number').notNull().unique(),
    orderId: uuid('order_id').notNull(),
    orderNumber: text('order_number').notNull(),
    zohoInvoiceId: text('zoho_invoice_id'),
    zohoInvoiceNumber: text('zoho_invoice_number'),
    zohoBillId: text('zoho_bill_id'),
    ownerId: uuid('owner_id')
      .references(() => partners.id)
      .notNull(),
    ownerName: text('owner_name').notNull(),
    saleAmount: doublePrecision('sale_amount').notNull(),
    commissionPercent: doublePrecision('commission_percent').notNull(),
    commissionAmount: doublePrecision('commission_amount').notNull(),
    owedToOwner: doublePrecision('owed_to_owner').notNull(),
    currency: text('currency').default('USD'),
    status: settlementStatus('status').default('pending'),
    invoicePaidAt: timestamp('invoice_paid_at', { mode: 'date' }),
    settledAt: timestamp('settled_at', { mode: 'date' }),
    settledBy: uuid('settled_by').references(() => users.id),
    notes: text('notes'),
    ...timestamps,
  },
  (table) => [
    index('consignment_settlements_owner_id_idx').on(table.ownerId),
    index('consignment_settlements_status_idx').on(table.status),
    index('consignment_settlements_order_id_idx').on(table.orderId),
  ],
);

export type ConsignmentSettlement = typeof consignmentSettlements.$inferSelect;

/**
 * Consignment Settlement Items - line items for settlements
 */
export const consignmentSettlementItems = pgTable(
  'consignment_settlement_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    settlementId: uuid('settlement_id')
      .references(() => consignmentSettlements.id)
      .notNull(),
    lwin18: text('lwin18').notNull(),
    productName: text('product_name').notNull(),
    quantityCases: integer('quantity_cases').notNull(),
    unitPrice: doublePrecision('unit_price').notNull(),
    lineTotal: doublePrecision('line_total').notNull(),
    stockId: uuid('stock_id').references(() => wmsStock.id),
    lotNumber: text('lot_number'),
    ...timestamps,
  },
  (table) => [index('consignment_settlement_items_settlement_id_idx').on(table.settlementId)],
);

export type ConsignmentSettlementItem = typeof consignmentSettlementItems.$inferSelect;

/**
 * WMS Receiving Draft Status
 */
export const wmsReceivingDraftStatus = pgEnum('wms_receiving_draft_status', [
  'in_progress',
  'completed',
]);

/**
 * WMS Receiving Draft Item - individual item in a receiving draft
 */
interface WmsReceivingDraftItem {
  id: string;
  shipmentItemId: string | null;
  baseItemId: string | null;
  productName: string;
  producer?: string | null;
  vintage?: number | null;
  lwin?: string | null;
  supplierSku?: string | null; // Supplier's own reference code (e.g., W-codes from CRURATED)
  expectedCases: number;
  receivedCases: number;
  expectedBottlesPerCase: number;
  expectedBottleSizeMl: number;
  receivedBottlesPerCase: number;
  receivedBottleSizeMl: number;
  packChanged: boolean;
  isAddedItem: boolean;
  isChecked: boolean;
  locationId?: string;
  expiryDate?: string;
  notes?: string;
  /** URLs of photos captured during receiving (e.g., case condition, labels) */
  photos?: string[];
}

/**
 * WMS Receiving Drafts - persists in-progress receiving data
 *
 * Allows receiving to be done over multiple sessions (can take hours)
 * Items are saved as they're checked off
 */
export const wmsReceivingDrafts = pgTable(
  'wms_receiving_drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shipmentId: uuid('shipment_id')
      .references(() => logisticsShipments.id)
      .notNull()
      .unique(),
    items: jsonb('items').$type<WmsReceivingDraftItem[]>().notNull(),
    notes: text('notes'),
    status: wmsReceivingDraftStatus('status').default('in_progress'),
    lastModifiedBy: uuid('last_modified_by').references(() => users.id),
    lastModifiedAt: timestamp('last_modified_at', { mode: 'date' }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => [
    index('wms_receiving_drafts_shipment_id_idx').on(table.shipmentId),
    index('wms_receiving_drafts_status_idx').on(table.status),
  ],
);

export type WmsReceivingDraft = typeof wmsReceivingDrafts.$inferSelect;
export type WmsReceivingDraftItemType = WmsReceivingDraftItem;

/**
 * Zoho Sales Order Status
 */
export const zohoSalesOrderStatus = pgEnum('zoho_sales_order_status', [
  'synced',
  'approved',
  'picking',
  'picked',
  'dispatched',
  'delivered',
  'cancelled',
]);

/**
 * Zoho Sales Orders - synced from Zoho Books
 *
 * Traditional B2B sales that originate in Zoho Books and need fulfillment.
 * These are separate from Private Client Orders (PCO).
 */
export const zohoSalesOrders = pgTable(
  'zoho_sales_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    zohoSalesOrderId: text('zoho_salesorder_id').notNull().unique(),
    salesOrderNumber: text('salesorder_number').notNull(),
    zohoCustomerId: text('zoho_customer_id').notNull(),
    customerName: text('customer_name').notNull(),
    zohoStatus: text('zoho_status').notNull(),
    status: zohoSalesOrderStatus('status').default('synced'),
    orderDate: date('order_date', { mode: 'date' }).notNull(),
    shipmentDate: date('shipment_date', { mode: 'date' }),
    referenceNumber: text('reference_number'),
    subTotal: doublePrecision('sub_total').notNull(),
    total: doublePrecision('total').notNull(),
    currencyCode: text('currency_code').default('USD'),
    shippingCharge: doublePrecision('shipping_charge'),
    discount: doublePrecision('discount'),
    notes: text('notes'),
    billingAddress: jsonb('billing_address'),
    shippingAddress: jsonb('shipping_address'),
    pickListId: uuid('pick_list_id').references(() => wmsPickLists.id),
    dispatchBatchId: uuid('dispatch_batch_id').references(() => wmsDispatchBatches.id),
    zohoCreatedTime: timestamp('zoho_created_time', { mode: 'date' }),
    zohoLastModifiedTime: timestamp('zoho_last_modified_time', { mode: 'date' }),
    lastSyncAt: timestamp('last_sync_at', { mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    index('zoho_sales_orders_zoho_id_idx').on(table.zohoSalesOrderId),
    index('zoho_sales_orders_status_idx').on(table.status),
    index('zoho_sales_orders_customer_idx').on(table.zohoCustomerId),
    index('zoho_sales_orders_dispatch_batch_idx').on(table.dispatchBatchId),
  ],
);

export type ZohoSalesOrder = typeof zohoSalesOrders.$inferSelect;

/**
 * Zoho Sales Order Items - line items from Zoho
 */
export const zohoSalesOrderItems = pgTable(
  'zoho_sales_order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salesOrderId: uuid('sales_order_id')
      .references(() => zohoSalesOrders.id, { onDelete: 'cascade' })
      .notNull(),
    zohoLineItemId: text('zoho_line_item_id').notNull(),
    zohoItemId: text('zoho_item_id'),
    sku: text('sku'),
    name: text('name').notNull(),
    description: text('description'),
    rate: doublePrecision('rate').notNull(),
    quantity: integer('quantity').notNull(),
    quantityPicked: integer('quantity_picked').default(0),
    quantityShipped: integer('quantity_shipped').default(0),
    unit: text('unit'),
    discount: doublePrecision('discount'),
    itemTotal: doublePrecision('item_total').notNull(),
    lwin18: text('lwin18'),
    stockId: uuid('stock_id').references(() => wmsStock.id),
    ...timestamps,
  },
  (table) => [index('zoho_sales_order_items_order_idx').on(table.salesOrderId)],
);

export type ZohoSalesOrderItem = typeof zohoSalesOrderItems.$inferSelect;

/**
 * Zoho Invoices - synced from Zoho Books for revenue KPIs
 */
export const zohoInvoices = pgTable(
  'zoho_invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    zohoInvoiceId: text('zoho_invoice_id').notNull().unique(),
    invoiceNumber: text('invoice_number').notNull(),
    zohoCustomerId: text('zoho_customer_id').notNull(),
    customerName: text('customer_name').notNull(),
    status: text('status').notNull(),
    invoiceDate: date('invoice_date', { mode: 'date' }).notNull(),
    dueDate: date('due_date', { mode: 'date' }),
    referenceNumber: text('reference_number'),
    subTotal: doublePrecision('sub_total').notNull(),
    total: doublePrecision('total').notNull(),
    balance: doublePrecision('balance').notNull().default(0),
    currencyCode: text('currency_code').default('USD'),
    lastSyncAt: timestamp('last_sync_at', { mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    index('zoho_invoices_zoho_id_idx').on(table.zohoInvoiceId),
    index('zoho_invoices_date_idx').on(table.invoiceDate),
    index('zoho_invoices_status_idx').on(table.status),
  ],
);

export type ZohoInvoice = typeof zohoInvoices.$inferSelect;

// ---------------------------------------------------------------------------
// AI Agents
// ---------------------------------------------------------------------------

export const agentRunStatus = pgEnum('agent_run_status', ['running', 'completed', 'failed']);

/**
 * Agent Runs - tracks each AI agent execution
 */
export const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: text('agent_id').notNull(),
    status: agentRunStatus('status').notNull().default('running'),
    startedAt: timestamp('started_at', { mode: 'date' }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { mode: 'date' }),
    error: text('error'),
    metadata: jsonb('metadata'),
    ...timestamps,
  },
  (table) => [
    index('agent_runs_agent_id_idx').on(table.agentId),
    index('agent_runs_status_idx').on(table.status),
  ],
).enableRLS();

export type AgentRun = typeof agentRuns.$inferSelect;

/**
 * Agent Outputs - briefing output stored per run
 */
export const agentOutputs = pgTable(
  'agent_outputs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: text('agent_id').notNull(),
    runId: uuid('run_id')
      .references(() => agentRuns.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    data: jsonb('data'),
    ...timestamps,
  },
  (table) => [
    index('agent_outputs_agent_id_idx').on(table.agentId),
    index('agent_outputs_run_id_idx').on(table.runId),
  ],
).enableRLS();

export type AgentOutput = typeof agentOutputs.$inferSelect;

/**
 * Competitor Wines - uploaded competitor price data for Scout analysis
 */
export const competitorWines = pgTable(
  'competitor_wines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    competitorName: text('competitor_name').notNull(),
    productName: text('product_name').notNull(),
    vintage: text('vintage'),
    country: text('country'),
    region: text('region'),
    bottleSize: text('bottle_size'),
    sellingPriceAed: doublePrecision('selling_price_aed'),
    sellingPriceUsd: doublePrecision('selling_price_usd'),
    quantity: integer('quantity'),
    source: text('source'),
    uploadedAt: timestamp('uploaded_at', { mode: 'date' }).notNull().defaultNow(),
    uploadedBy: uuid('uploaded_by').references(() => users.id),
    isActive: boolean('is_active').notNull().default(true),
    lwin18Match: text('lwin18_match'),
    ...timestamps,
  },
  (table) => [
    index('competitor_wines_competitor_idx').on(table.competitorName),
    index('competitor_wines_active_idx').on(table.isActive),
    index('competitor_wines_lwin18_idx').on(table.lwin18Match),
  ],
).enableRLS();

export type CompetitorWine = typeof competitorWines.$inferSelect;

/**
 * Agent Configs - key-value configuration store for agent customization
 */
export const agentConfigs = pgTable(
  'agent_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: text('agent_id').notNull(),
    configKey: text('config_key').notNull(),
    configValue: text('config_value').notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
    updatedBy: uuid('updated_by').references(() => users.id),
  },
  (table) => [
    uniqueIndex('agent_configs_agent_key_idx').on(table.agentId, table.configKey),
  ],
).enableRLS();

export type AgentConfig = typeof agentConfigs.$inferSelect;

/**
 * Supplier Wines - uploaded supplier price data for Buyer analysis
 */
export const supplierWines = pgTable(
  'supplier_wines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    partnerId: uuid('partner_id').references(() => partners.id),
    partnerName: text('partner_name').notNull(),
    productName: text('product_name').notNull(),
    vintage: text('vintage'),
    country: text('country'),
    region: text('region'),
    bottleSize: text('bottle_size'),
    costPriceUsd: doublePrecision('cost_price_usd'),
    costPriceGbp: doublePrecision('cost_price_gbp'),
    costPriceEur: doublePrecision('cost_price_eur'),
    moq: integer('moq'),
    availableQuantity: integer('available_quantity'),
    source: text('source'),
    uploadedAt: timestamp('uploaded_at', { mode: 'date' }).notNull().defaultNow(),
    uploadedBy: uuid('uploaded_by').references(() => users.id),
    isActive: boolean('is_active').notNull().default(true),
    lwin18Match: text('lwin18_match'),
    ...timestamps,
  },
  (table) => [
    index('supplier_wines_partner_idx').on(table.partnerId),
    index('supplier_wines_active_idx').on(table.isActive),
    index('supplier_wines_lwin18_idx').on(table.lwin18Match),
  ],
).enableRLS();

export type SupplierWine = typeof supplierWines.$inferSelect;
