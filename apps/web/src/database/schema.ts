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

export const customerType = pgEnum('user_type', ['b2b', 'b2c']);

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
  'po_submitted',
  'po_confirmed',
]);

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
    ...timestamps,
  },
  (table) => [
    index('quotes_user_id_idx').on(table.userId),
    index('quotes_created_at_idx').on(table.createdAt),
    index('quotes_status_idx').on(table.status),
  ],
).enableRLS();

export type Quote = typeof quotes.$inferSelect;

// Partner management enums
export const partnerType = pgEnum('partner_type', [
  'retailer',
  'sommelier',
  'distributor',
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
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
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
    ...timestamps,
  },
  (table) => [
    index('partners_user_id_idx').on(table.userId),
    index('partners_type_idx').on(table.type),
    index('partners_status_idx').on(table.status),
  ],
).enableRLS();

export type Partner = typeof partners.$inferSelect;

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
  ],
).enableRLS();
