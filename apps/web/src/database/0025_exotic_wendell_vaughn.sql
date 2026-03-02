CREATE TABLE "agent_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"config_key" text NOT NULL,
	"config_value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "agent_configs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "supplier_wines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid,
	"partner_name" text NOT NULL,
	"product_name" text NOT NULL,
	"vintage" text,
	"country" text,
	"region" text,
	"bottle_size" text,
	"cost_price_usd" double precision,
	"cost_price_gbp" double precision,
	"cost_price_eur" double precision,
	"moq" integer,
	"available_quantity" integer,
	"source" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"uploaded_by" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"lwin18_match" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supplier_wines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "zoho_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zoho_invoice_id" text NOT NULL,
	"invoice_number" text NOT NULL,
	"zoho_customer_id" text NOT NULL,
	"customer_name" text NOT NULL,
	"status" text NOT NULL,
	"invoice_date" date NOT NULL,
	"due_date" date,
	"reference_number" text,
	"sub_total" double precision NOT NULL,
	"total" double precision NOT NULL,
	"balance" double precision DEFAULT 0 NOT NULL,
	"currency_code" text DEFAULT 'USD',
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "zoho_invoices_zoho_invoice_id_unique" UNIQUE("zoho_invoice_id")
);
--> statement-breakpoint
ALTER TABLE "logistics_shipments" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "wms_stock" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "agent_configs" ADD CONSTRAINT "agent_configs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_wines" ADD CONSTRAINT "supplier_wines_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_wines" ADD CONSTRAINT "supplier_wines_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_configs_agent_key_idx" ON "agent_configs" USING btree ("agent_id","config_key");--> statement-breakpoint
CREATE INDEX "supplier_wines_partner_idx" ON "supplier_wines" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "supplier_wines_active_idx" ON "supplier_wines" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "supplier_wines_lwin18_idx" ON "supplier_wines" USING btree ("lwin18_match");--> statement-breakpoint
CREATE INDEX "zoho_invoices_zoho_id_idx" ON "zoho_invoices" USING btree ("zoho_invoice_id");--> statement-breakpoint
CREATE INDEX "zoho_invoices_date_idx" ON "zoho_invoices" USING btree ("invoice_date");--> statement-breakpoint
CREATE INDEX "zoho_invoices_status_idx" ON "zoho_invoices" USING btree ("status");