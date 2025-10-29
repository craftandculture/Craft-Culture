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

export const productSource = pgEnum('product_source', ['cultx']);

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
  companyName: text('company_name'),
  companyLogo: text('company_logo'),
  onboardingCompletedAt: timestamp('onboarding_completed_at', {
    mode: 'date',
  }),
  pricingModelId: uuid('pricing_model_id').references(() => pricingModels.id, {
    onDelete: 'set null',
  }),
  approvalStatus: approvalStatus('approval_status').notNull().default('pending'),
  approvedAt: timestamp('approved_at', { mode: 'date' }),
  approvedBy: uuid('approved_by'),

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
    ...timestamps,
  },
  (table) => [
    index('quotes_user_id_idx').on(table.userId),
    index('quotes_created_at_idx').on(table.createdAt),
    index('quotes_status_idx').on(table.status),
  ],
).enableRLS();

export type Quote = typeof quotes.$inferSelect;
