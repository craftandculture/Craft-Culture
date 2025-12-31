CREATE TYPE "public"."document_extraction_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."order_item_source" AS ENUM('partner_local', 'partner_airfreight', 'cc_inventory', 'manual');--> statement-breakpoint
CREATE TYPE "public"."order_item_stock_status" AS ENUM('pending', 'confirmed', 'at_cc_bonded', 'in_transit_to_cc', 'at_distributor', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."private_client_document_type" AS ENUM('partner_invoice', 'cc_invoice', 'distributor_invoice', 'payment_proof');--> statement-breakpoint
CREATE TYPE "public"."private_client_order_status" AS ENUM('draft', 'submitted', 'under_cc_review', 'revision_requested', 'cc_approved', 'awaiting_client_payment', 'client_paid', 'awaiting_distributor_payment', 'distributor_paid', 'awaiting_partner_payment', 'partner_paid', 'stock_in_transit', 'with_distributor', 'out_for_delivery', 'delivered', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."user_type" ADD VALUE 'private_clients';--> statement-breakpoint
ALTER TYPE "public"."partner_type" ADD VALUE 'wine_partner';--> statement-breakpoint
CREATE TABLE "private_client_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"address_line_1" text,
	"address_line_2" text,
	"city" text,
	"state_province" text,
	"postal_code" text,
	"country" text,
	"wine_preferences" text,
	"delivery_instructions" text,
	"payment_notes" text,
	"notes" text,
	"total_orders" integer DEFAULT 0 NOT NULL,
	"total_spend_usd" double precision DEFAULT 0 NOT NULL,
	"last_order_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "private_client_contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "private_client_order_activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"user_id" uuid,
	"partner_id" uuid,
	"action" text NOT NULL,
	"previous_status" "private_client_order_status",
	"new_status" "private_client_order_status",
	"metadata" jsonb,
	"notes" text,
	"accessed_client_data" boolean DEFAULT false NOT NULL,
	"client_data_fields" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "private_client_order_activity_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "private_client_order_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"document_type" "private_client_document_type" NOT NULL,
	"file_url" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"uploaded_by" uuid NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"extraction_status" "document_extraction_status" DEFAULT 'pending' NOT NULL,
	"extracted_data" jsonb,
	"extraction_error" text,
	"extracted_at" timestamp,
	"is_matched" boolean DEFAULT false NOT NULL,
	"matched_at" timestamp,
	"match_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "private_client_order_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "private_client_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"product_offer_id" uuid,
	"product_name" text NOT NULL,
	"producer" text,
	"vintage" text,
	"region" text,
	"lwin" text,
	"bottle_size" text,
	"case_config" integer DEFAULT 12,
	"source" "order_item_source" DEFAULT 'manual' NOT NULL,
	"stock_status" "order_item_stock_status" DEFAULT 'pending' NOT NULL,
	"stock_confirmed_at" timestamp,
	"stock_notes" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"price_per_case_usd" double precision NOT NULL,
	"total_usd" double precision NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "private_client_order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "private_client_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"partner_id" uuid NOT NULL,
	"distributor_id" uuid,
	"client_id" uuid,
	"client_name" text NOT NULL,
	"client_email" text,
	"client_phone" text,
	"client_address" text,
	"delivery_notes" text,
	"status" "private_client_order_status" DEFAULT 'draft' NOT NULL,
	"subtotal_usd" double precision DEFAULT 0 NOT NULL,
	"duty_usd" double precision DEFAULT 0 NOT NULL,
	"vat_usd" double precision DEFAULT 0 NOT NULL,
	"logistics_usd" double precision DEFAULT 0 NOT NULL,
	"total_usd" double precision DEFAULT 0 NOT NULL,
	"total_aed" double precision,
	"usd_to_aed_rate" double precision,
	"item_count" integer DEFAULT 0 NOT NULL,
	"case_count" integer DEFAULT 0 NOT NULL,
	"partner_notes" text,
	"cc_notes" text,
	"distributor_notes" text,
	"submitted_at" timestamp,
	"submitted_by" uuid,
	"cc_review_started_at" timestamp,
	"cc_reviewed_by" uuid,
	"revision_requested_at" timestamp,
	"revision_requested_by" uuid,
	"revision_reason" text,
	"cc_approved_at" timestamp,
	"cc_approved_by" uuid,
	"distributor_assigned_at" timestamp,
	"distributor_assigned_by" uuid,
	"client_paid_at" timestamp,
	"client_payment_confirmed_by" uuid,
	"client_payment_reference" text,
	"distributor_paid_at" timestamp,
	"distributor_payment_confirmed_by" uuid,
	"distributor_payment_reference" text,
	"partner_paid_at" timestamp,
	"partner_payment_confirmed_by" uuid,
	"partner_payment_reference" text,
	"stock_released_at" timestamp,
	"stock_released_by" uuid,
	"stock_received_at" timestamp,
	"stock_received_by" uuid,
	"out_for_delivery_at" timestamp,
	"out_for_delivery_by" uuid,
	"delivered_at" timestamp,
	"delivered_confirmed_by" uuid,
	"cancelled_at" timestamp,
	"cancelled_by" uuid,
	"cancellation_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "private_client_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
ALTER TABLE "private_client_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "brand_color" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "margin_percentage" double precision DEFAULT 40.6;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "logistics_cost_per_case" double precision;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "currency_preference" text DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "private_client_contacts" ADD CONSTRAINT "private_client_contacts_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_client_order_activity_logs" ADD CONSTRAINT "private_client_order_activity_logs_order_id_private_client_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."private_client_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_client_order_activity_logs" ADD CONSTRAINT "private_client_order_activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_client_order_activity_logs" ADD CONSTRAINT "private_client_order_activity_logs_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_client_order_documents" ADD CONSTRAINT "private_client_order_documents_order_id_private_client_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."private_client_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_client_order_documents" ADD CONSTRAINT "private_client_order_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_client_order_items" ADD CONSTRAINT "private_client_order_items_order_id_private_client_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."private_client_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_client_order_items" ADD CONSTRAINT "private_client_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_client_order_items" ADD CONSTRAINT "private_client_order_items_product_offer_id_product_offers_id_fk" FOREIGN KEY ("product_offer_id") REFERENCES "public"."product_offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD CONSTRAINT "private_client_orders_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD CONSTRAINT "private_client_orders_distributor_id_partners_id_fk" FOREIGN KEY ("distributor_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD CONSTRAINT "private_client_orders_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD CONSTRAINT "private_client_orders_cc_reviewed_by_users_id_fk" FOREIGN KEY ("cc_reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD CONSTRAINT "private_client_orders_revision_requested_by_users_id_fk" FOREIGN KEY ("revision_requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD CONSTRAINT "private_client_orders_cc_approved_by_users_id_fk" FOREIGN KEY ("cc_approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD CONSTRAINT "private_client_orders_distributor_assigned_by_users_id_fk" FOREIGN KEY ("distributor_assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD CONSTRAINT "private_client_orders_client_payment_confirmed_by_users_id_fk" FOREIGN KEY ("client_payment_confirmed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD CONSTRAINT "private_client_orders_distributor_payment_confirmed_by_users_id_fk" FOREIGN KEY ("distributor_payment_confirmed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD CONSTRAINT "private_client_orders_partner_payment_confirmed_by_users_id_fk" FOREIGN KEY ("partner_payment_confirmed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD CONSTRAINT "private_client_orders_stock_released_by_users_id_fk" FOREIGN KEY ("stock_released_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD CONSTRAINT "private_client_orders_stock_received_by_users_id_fk" FOREIGN KEY ("stock_received_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD CONSTRAINT "private_client_orders_out_for_delivery_by_users_id_fk" FOREIGN KEY ("out_for_delivery_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD CONSTRAINT "private_client_orders_delivered_confirmed_by_users_id_fk" FOREIGN KEY ("delivered_confirmed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD CONSTRAINT "private_client_orders_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "private_client_contacts_partner_id_idx" ON "private_client_contacts" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "private_client_contacts_email_idx" ON "private_client_contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "private_client_contacts_name_trigram_idx" ON "private_client_contacts" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "private_client_order_activity_logs_order_id_idx" ON "private_client_order_activity_logs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "private_client_order_activity_logs_user_id_idx" ON "private_client_order_activity_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "private_client_order_activity_logs_created_at_idx" ON "private_client_order_activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "private_client_order_activity_logs_action_idx" ON "private_client_order_activity_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "private_client_order_documents_order_id_idx" ON "private_client_order_documents" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "private_client_order_documents_document_type_idx" ON "private_client_order_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "private_client_order_documents_extraction_status_idx" ON "private_client_order_documents" USING btree ("extraction_status");--> statement-breakpoint
CREATE INDEX "private_client_order_items_order_id_idx" ON "private_client_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "private_client_order_items_product_id_idx" ON "private_client_order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "private_client_order_items_source_idx" ON "private_client_order_items" USING btree ("source");--> statement-breakpoint
CREATE INDEX "private_client_order_items_stock_status_idx" ON "private_client_order_items" USING btree ("stock_status");--> statement-breakpoint
CREATE INDEX "private_client_orders_partner_id_idx" ON "private_client_orders" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "private_client_orders_distributor_id_idx" ON "private_client_orders" USING btree ("distributor_id");--> statement-breakpoint
CREATE INDEX "private_client_orders_client_id_idx" ON "private_client_orders" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "private_client_orders_status_idx" ON "private_client_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "private_client_orders_created_at_idx" ON "private_client_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "private_client_orders_order_number_idx" ON "private_client_orders" USING btree ("order_number");