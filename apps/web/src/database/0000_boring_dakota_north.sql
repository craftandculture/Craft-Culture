CREATE EXTENSION IF NOT EXISTS "pg_trgm";

--> statement-breakpoint
CREATE TYPE "public"."user_type" AS ENUM('b2b', 'b2c');

--> statement-breakpoint
CREATE TYPE "public"."product_source" AS ENUM('cultx');

--> statement-breakpoint
CREATE TABLE "accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "access_token_expires_at" timestamp with time zone,
  "refresh_token_expires_at" timestamp with time zone,
  "scope" text,
  "id_token" text,
  "password" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE TABLE "passkeys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text,
  "public_key" text NOT NULL,
  "user_id" uuid NOT NULL,
  "credential_id" text NOT NULL,
  "counter" integer NOT NULL,
  "device_type" text NOT NULL,
  "backed_up" boolean NOT NULL,
  "transports" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
ALTER TABLE "passkeys" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE TABLE "pricing_models" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "is_public" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "google_sheet_id" text NOT NULL,
  "sheet_index" integer DEFAULT 0 NOT NULL,
  "formula_data" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "pricing_models_google_sheet_id_unique" UNIQUE ("google_sheet_id"),
  CONSTRAINT "pricing_models_google_sheet_id_sheet_index_unique" UNIQUE ("google_sheet_id", "sheet_index")
);

--> statement-breakpoint
ALTER TABLE "pricing_models" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE TABLE "product_offers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL,
  "external_id" text NOT NULL,
  "source" "product_source" NOT NULL,
  "price" double precision DEFAULT 0 NOT NULL,
  "currency" text NOT NULL,
  "unit_count" integer NOT NULL,
  "unit_size" text NOT NULL,
  "available_quantity" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "product_offers_external_id_unique" UNIQUE ("external_id")
);

--> statement-breakpoint
ALTER TABLE "product_offers" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE TABLE "products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lwin18" text NOT NULL,
  "name" text NOT NULL,
  "region" text,
  "producer" text,
  "year" integer,
  "image_url" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "products_lwin18_unique" UNIQUE ("lwin18")
);

--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE TABLE "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "token" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "sessions_token_unique" UNIQUE ("token")
);

--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "customer_type" "user_type" DEFAULT 'b2c' NOT NULL,
  "onboarding_completed_at" timestamp,
  "pricing_model_id" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE ("email")
);

--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE TABLE "verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
ALTER TABLE "verifications" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "accounts"
ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "passkeys"
ADD CONSTRAINT "passkeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "product_offers"
ADD CONSTRAINT "product_offers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products" ("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "sessions"
ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "users"
ADD CONSTRAINT "users_pricing_model_id_pricing_models_id_fk" FOREIGN KEY ("pricing_model_id") REFERENCES "public"."pricing_models" ("id") ON DELETE set null ON UPDATE no action;

--> statement-breakpoint
CREATE INDEX "products_search_idx" ON "products" USING gin (
  (
    setweight(to_tsvector('english', coalesce("name", '')), 'A') || setweight(
      to_tsvector('english', coalesce("producer", '')),
      'A'
    ) || setweight(
      to_tsvector('english', coalesce("lwin18", '')),
      'A'
    ) || setweight(
      to_tsvector('english', coalesce("region", '')),
      'B'
    ) || setweight(
      to_tsvector('english', coalesce("year"::text, '')),
      'C'
    )
  )
);

--> statement-breakpoint
CREATE INDEX "products_name_trigram_idx" ON "products" USING gin ("name" gin_trgm_ops);

--> statement-breakpoint
CREATE INDEX "products_producer_trigram_idx" ON "products" USING gin ("producer" gin_trgm_ops);

--> statement-breakpoint
CREATE INDEX "products_lwin_trigram_idx" ON "products" USING gin ("lwin18" gin_trgm_ops);
