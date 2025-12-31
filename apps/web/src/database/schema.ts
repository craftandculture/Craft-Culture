import { sql } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { CellMappingSchema } from '@/app/_pricingModels/schemas/cellMappingSchema';

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

export const sheets = pgTable('sheets', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  googleSheetId: text('google_sheet_id').notNull().unique(),
  formulaData: jsonb('formula_data').notNull(),
  ...timestamps,
}).enableRLS();

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
    cellMappings: jsonb('cell_mappings').$type<CellMappingSchema>().notNull(),
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

  ...timestamps,
}).enableRLS();

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
  ...timestamps,
}).enableRLS();

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
}).enableRLS();

export const verifications = pgTable('verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', {
    mode: 'date',
    withTimezone: true,
  }).notNull(),
  ...timestamps,
}).enableRLS();

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
  ...timestamps,
}).enableRLS();

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
    // Private client pricing configuration
    marginPercentage: doublePrecision('margin_percentage').default(40.6),
    logisticsCostPerCase: doublePrecision('logistics_cost_per_case'),
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
    ...timestamps,
  },
  (table) => [
    index('partners_user_id_idx').on(table.userId),
    index('partners_type_idx').on(table.type),
    index('partners_status_idx').on(table.status),
  ],
).enableRLS();

export type Partner = typeof partners.$inferSelect;

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
  'payment_received',
  'payment_proof_submitted',
  'order_delivered',
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
  'awaiting_client_payment',
  'client_paid',
  'awaiting_distributor_payment',
  'distributor_paid',
  'awaiting_partner_payment',
  'partner_paid',
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
  'at_cc_bonded',
  'in_transit_to_cc',
  'at_distributor',
  'delivered',
]);

export const privateClientDocumentType = pgEnum('private_client_document_type', [
  'partner_invoice',
  'cc_invoice',
  'distributor_invoice',
  'payment_proof',
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

    // Partner who created the order (wine partner)
    partnerId: uuid('partner_id')
      .references(() => partners.id, { onDelete: 'restrict' })
      .notNull(),

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

    // Payment timestamps
    clientPaidAt: timestamp('client_paid_at', { mode: 'date' }),
    clientPaymentConfirmedBy: uuid('client_payment_confirmed_by').references(
      () => users.id,
      { onDelete: 'set null' },
    ),
    clientPaymentReference: text('client_payment_reference'),

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

    cancelledAt: timestamp('cancelled_at', { mode: 'date' }),
    cancelledBy: uuid('cancelled_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    cancellationReason: text('cancellation_reason'),

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
