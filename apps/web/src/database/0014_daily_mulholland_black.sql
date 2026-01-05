CREATE TYPE "public"."pricing_module" AS ENUM('b2b', 'pco', 'pocket_cellar', 'exchange_rates');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'po_approved' BEFORE 'payment_received';--> statement-breakpoint
ALTER TYPE "public"."private_client_order_status" ADD VALUE 'awaiting_payment_verification' BEFORE 'client_paid';--> statement-breakpoint
CREATE TABLE "order_pricing_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"cc_margin_percent" double precision,
	"import_duty_percent" double precision,
	"transfer_cost_percent" double precision,
	"distributor_margin_percent" double precision,
	"vat_percent" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"notes" text,
	CONSTRAINT "order_pricing_overrides_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
ALTER TABLE "order_pricing_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_pricing_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"cc_margin_percent" double precision,
	"import_duty_percent" double precision,
	"transfer_cost_percent" double precision,
	"distributor_margin_percent" double precision,
	"vat_percent" double precision,
	"effective_from" timestamp,
	"effective_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"notes" text,
	CONSTRAINT "partner_pricing_overrides_partner_id_unique" UNIQUE("partner_id")
);
--> statement-breakpoint
ALTER TABLE "partner_pricing_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pricing_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module" "pricing_module" NOT NULL,
	"key" text NOT NULL,
	"value" double precision NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "pricing_config" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "private_client_order_items" ALTER COLUMN "stock_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "private_client_order_items" ALTER COLUMN "stock_status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."order_item_stock_status";--> statement-breakpoint
CREATE TYPE "public"."order_item_stock_status" AS ENUM('pending', 'confirmed', 'in_transit_to_cc', 'at_cc_bonded', 'in_transit_to_distributor', 'at_distributor', 'delivered');--> statement-breakpoint
ALTER TABLE "private_client_order_items" ALTER COLUMN "stock_status" SET DEFAULT 'pending'::"public"."order_item_stock_status";--> statement-breakpoint
ALTER TABLE "private_client_order_items" ALTER COLUMN "stock_status" SET DATA TYPE "public"."order_item_stock_status" USING "stock_status"::"public"."order_item_stock_status";--> statement-breakpoint
ALTER TABLE "partners" ALTER COLUMN "logistics_cost_per_case" SET DEFAULT 60;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "pco_duty_rate" double precision DEFAULT 0.05;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "pco_vat_rate" double precision DEFAULT 0.05;--> statement-breakpoint
ALTER TABLE "private_client_order_items" ADD COLUMN "stock_expected_at" timestamp;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "distributor_payment_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "distributor_payment_verified_by" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "impersonated_by" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_test_user" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "order_pricing_overrides" ADD CONSTRAINT "order_pricing_overrides_order_id_private_client_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."private_client_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_pricing_overrides" ADD CONSTRAINT "order_pricing_overrides_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_pricing_overrides" ADD CONSTRAINT "partner_pricing_overrides_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_pricing_overrides" ADD CONSTRAINT "partner_pricing_overrides_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_config" ADD CONSTRAINT "pricing_config_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_pricing_overrides_order_id_idx" ON "order_pricing_overrides" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "partner_pricing_overrides_partner_id_idx" ON "partner_pricing_overrides" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "pricing_config_module_idx" ON "pricing_config" USING btree ("module");--> statement-breakpoint
CREATE INDEX "pricing_config_module_key_idx" ON "pricing_config" USING btree ("module","key");--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD CONSTRAINT "private_client_orders_distributor_payment_verified_by_users_id_fk" FOREIGN KEY ("distributor_payment_verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_impersonated_by_users_id_fk" FOREIGN KEY ("impersonated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;