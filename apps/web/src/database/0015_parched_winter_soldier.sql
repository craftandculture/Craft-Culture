CREATE TYPE "public"."lwin_colour" AS ENUM('red', 'white', 'rose', 'amber', 'orange', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."lwin_status" AS ENUM('live', 'obsolete');--> statement-breakpoint
CREATE TYPE "public"."lwin_type" AS ENUM('wine', 'fortified', 'spirit', 'beer', 'cider', 'sake', 'other');--> statement-breakpoint
CREATE TYPE "public"."source_customer_po_item_match_source" AS ENUM('auto', 'manual', 'new_item');--> statement-breakpoint
CREATE TYPE "public"."source_customer_po_item_status" AS ENUM('pending_match', 'matched', 'unmatched', 'new_item', 'ordered', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."source_customer_po_status" AS ENUM('draft', 'parsing', 'matching', 'matched', 'reviewing', 'orders_generated', 'awaiting_confirmations', 'confirmed', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."source_purchase_order_item_status" AS ENUM('pending', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."source_purchase_order_status" AS ENUM('draft', 'sent', 'confirmed', 'partially_confirmed', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."source_rfq_item_status" AS ENUM('pending', 'quoted', 'selected', 'self_sourced', 'unsourceable', 'no_response');--> statement-breakpoint
CREATE TYPE "public"."source_rfq_partner_response_status" AS ENUM('pending', 'viewed', 'in_progress', 'submitted', 'declined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."source_rfq_quote_confirmation_status" AS ENUM('pending', 'confirmed', 'updated', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."source_rfq_quote_type" AS ENUM('exact', 'alt_vintage', 'alternative', 'not_available');--> statement-breakpoint
CREATE TYPE "public"."source_rfq_status" AS ENUM('draft', 'parsing', 'ready_to_send', 'sent', 'collecting', 'comparing', 'selecting', 'client_review', 'awaiting_confirmation', 'confirmed', 'quote_generated', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."source_self_sourcing_source" AS ENUM('inventory', 'exchange', 'direct', 'other');--> statement-breakpoint
CREATE TYPE "public"."source_self_sourcing_status" AS ENUM('pending', 'available', 'ordered', 'received', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."source_supplier_order_item_confirmation_status" AS ENUM('pending', 'confirmed', 'updated', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."source_supplier_order_status" AS ENUM('draft', 'sent', 'pending_confirmation', 'confirmed', 'partial', 'rejected', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."wine_synonym_type" AS ENUM('producer', 'grape', 'region', 'abbreviation');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'rfq_received';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'rfq_response_submitted';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'rfq_deadline_reminder';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'rfq_quotes_selected';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'po_received';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'supplier_order_received';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'supplier_order_confirmed';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'supplier_order_updated';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'supplier_order_rejected';--> statement-breakpoint
ALTER TYPE "public"."private_client_document_type" ADD VALUE 'proof_of_delivery';--> statement-breakpoint
CREATE TABLE "lwin_wines" (
	"lwin" text PRIMARY KEY NOT NULL,
	"status" "lwin_status" DEFAULT 'live' NOT NULL,
	"display_name" text NOT NULL,
	"producer_title" text,
	"producer_name" text,
	"wine" text,
	"country" text,
	"region" text,
	"sub_region" text,
	"site" text,
	"parcel" text,
	"colour" "lwin_colour",
	"type" "lwin_type",
	"sub_type" text,
	"designation" text,
	"classification" text,
	"vintage_config" text,
	"first_vintage" text,
	"final_vintage" text,
	"reference" text,
	"date_added" timestamp,
	"date_updated" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lwin_wines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"phone" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "partner_contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_customer_po_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_po_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"producer" text,
	"vintage" text,
	"region" text,
	"bottle_size" text,
	"case_config" integer,
	"lwin" text,
	"quantity" integer NOT NULL,
	"quantity_unit" text DEFAULT 'cases',
	"sell_price_per_bottle_usd" double precision,
	"sell_price_per_case_usd" double precision,
	"sell_line_total_usd" double precision,
	"matched_rfq_item_id" uuid,
	"matched_quote_id" uuid,
	"match_source" "source_customer_po_item_match_source",
	"match_confidence" double precision,
	"buy_price_per_bottle_usd" double precision,
	"buy_price_per_case_usd" double precision,
	"buy_line_total_usd" double precision,
	"profit_usd" double precision,
	"profit_margin_percent" double precision,
	"is_losing_item" boolean DEFAULT false,
	"status" "source_customer_po_item_status" DEFAULT 'pending_match' NOT NULL,
	"admin_notes" text,
	"original_text" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_customer_po_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_customer_pos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid,
	"po_number" text NOT NULL,
	"cc_po_number" text NOT NULL,
	"status" "source_customer_po_status" DEFAULT 'draft' NOT NULL,
	"customer_name" text NOT NULL,
	"customer_company" text,
	"customer_email" text,
	"customer_phone" text,
	"source_type" text,
	"source_file_name" text,
	"source_file_url" text,
	"raw_content" text,
	"total_sell_price_usd" double precision DEFAULT 0,
	"total_buy_price_usd" double precision DEFAULT 0,
	"total_profit_usd" double precision DEFAULT 0,
	"profit_margin_percent" double precision DEFAULT 0,
	"item_count" integer DEFAULT 0,
	"losing_item_count" integer DEFAULT 0,
	"parsed_at" timestamp,
	"matched_at" timestamp,
	"orders_generated_at" timestamp,
	"all_confirmed_at" timestamp,
	"admin_notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "source_customer_pos_cc_po_number_unique" UNIQUE("cc_po_number")
);
--> statement-breakpoint
ALTER TABLE "source_customer_pos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_market_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lwin" text NOT NULL,
	"avg_price_usd" double precision,
	"min_price_usd" double precision,
	"max_price_usd" double precision,
	"quote_count" integer DEFAULT 0 NOT NULL,
	"last_quoted_at" timestamp,
	"last_quoted_by" uuid,
	"last_quote_price" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "source_market_prices_lwin_unique" UNIQUE("lwin")
);
--> statement-breakpoint
ALTER TABLE "source_market_prices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_partner_metrics" (
	"partner_id" uuid PRIMARY KEY NOT NULL,
	"total_rfqs_received" integer DEFAULT 0 NOT NULL,
	"total_rfqs_responded" integer DEFAULT 0 NOT NULL,
	"avg_response_time_hours" double precision,
	"total_quotes_submitted" integer DEFAULT 0 NOT NULL,
	"total_quotes_won" integer DEFAULT 0 NOT NULL,
	"total_value_won_usd" double precision DEFAULT 0 NOT NULL,
	"response_rate" double precision,
	"win_rate" double precision,
	"best_price_rate" double precision,
	"last_rfq_received_at" timestamp,
	"last_response_at" timestamp,
	"last_win_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_partner_metrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"po_id" uuid NOT NULL,
	"rfq_item_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"producer" text,
	"vintage" text,
	"lwin" text,
	"quantity" integer NOT NULL,
	"unit_type" text DEFAULT 'case' NOT NULL,
	"case_config" integer,
	"unit_price_usd" double precision NOT NULL,
	"line_total_usd" double precision NOT NULL,
	"status" "source_purchase_order_item_status" DEFAULT 'pending' NOT NULL,
	"confirmed_at" timestamp,
	"rejection_reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_purchase_order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"po_number" text NOT NULL,
	"status" "source_purchase_order_status" DEFAULT 'draft' NOT NULL,
	"total_amount_usd" double precision,
	"currency" text DEFAULT 'USD' NOT NULL,
	"delivery_date" timestamp,
	"delivery_address" text,
	"delivery_instructions" text,
	"payment_terms" text,
	"notes" text,
	"pdf_url" text,
	"sent_at" timestamp,
	"sent_by" uuid,
	"confirmed_at" timestamp,
	"confirmed_by" uuid,
	"confirmation_notes" text,
	"estimated_delivery_date" timestamp,
	"shipped_at" timestamp,
	"tracking_number" text,
	"shipping_notes" text,
	"delivered_at" timestamp,
	"delivery_notes" text,
	"cancelled_at" timestamp,
	"cancelled_by" uuid,
	"cancellation_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "source_purchase_orders_po_number_unique" UNIQUE("po_number")
);
--> statement-breakpoint
ALTER TABLE "source_purchase_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_rfq_activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"user_id" uuid,
	"partner_id" uuid,
	"action" text NOT NULL,
	"previous_status" "source_rfq_status",
	"new_status" "source_rfq_status",
	"metadata" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_rfq_activity_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_rfq_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"producer" text,
	"vintage" text,
	"region" text,
	"country" text,
	"bottle_size" text,
	"case_config" integer,
	"lwin" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"quantity_unit" text DEFAULT 'cases' NOT NULL,
	"original_text" text,
	"parse_confidence" double precision,
	"status" "source_rfq_item_status" DEFAULT 'pending' NOT NULL,
	"selected_quote_id" uuid,
	"selected_at" timestamp,
	"selected_by" uuid,
	"calculated_price_usd" double precision,
	"final_price_usd" double precision,
	"price_adjusted_by" uuid,
	"admin_notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_rfq_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_rfq_partner_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_partner_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"notified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_rfq_partner_contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_rfq_partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"status" "source_rfq_partner_response_status" DEFAULT 'pending' NOT NULL,
	"notified_at" timestamp,
	"viewed_at" timestamp,
	"submitted_at" timestamp,
	"declined_at" timestamp,
	"decline_reason" text,
	"partner_notes" text,
	"quote_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_rfq_partners" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_rfq_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"rfq_partner_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"quote_type" "source_rfq_quote_type" DEFAULT 'exact' NOT NULL,
	"quoted_vintage" text,
	"alternative_product_name" text,
	"alternative_producer" text,
	"alternative_vintage" text,
	"alternative_region" text,
	"alternative_country" text,
	"alternative_bottle_size" text,
	"alternative_case_config" integer,
	"alternative_lwin" text,
	"alternative_reason" text,
	"not_available_reason" text,
	"cost_price_per_case_usd" double precision,
	"currency" text DEFAULT 'USD' NOT NULL,
	"case_config" text,
	"bottle_size" text,
	"moq" integer,
	"available_quantity" integer,
	"lead_time_days" integer,
	"stock_location" text,
	"stock_condition" text,
	"valid_until" timestamp,
	"notes" text,
	"is_selected" boolean DEFAULT false NOT NULL,
	"confirmation_status" "source_rfq_quote_confirmation_status",
	"confirmation_requested_at" timestamp,
	"confirmed_at" timestamp,
	"confirmation_notes" text,
	"updated_price_usd" double precision,
	"updated_available_qty" integer,
	"update_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_rfq_quotes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_rfqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_number" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "source_rfq_status" DEFAULT 'draft' NOT NULL,
	"source_type" text NOT NULL,
	"source_file_name" text,
	"source_file_url" text,
	"raw_input_text" text,
	"parsed_at" timestamp,
	"parsing_error" text,
	"distributor_name" text,
	"distributor_email" text,
	"distributor_company" text,
	"distributor_notes" text,
	"response_deadline" timestamp,
	"item_count" integer DEFAULT 0 NOT NULL,
	"partner_count" integer DEFAULT 0 NOT NULL,
	"response_count" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"sent_at" timestamp,
	"sent_by" uuid,
	"closed_at" timestamp,
	"closed_by" uuid,
	"client_approved_at" timestamp,
	"client_approved_by" uuid,
	"client_approval_notes" text,
	"confirmation_requested_at" timestamp,
	"confirmation_requested_by" uuid,
	"all_confirmed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "source_rfqs_rfq_number_unique" UNIQUE("rfq_number")
);
--> statement-breakpoint
ALTER TABLE "source_rfqs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_self_sourcing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_item_id" uuid NOT NULL,
	"source" "source_self_sourcing_source" NOT NULL,
	"source_details" text,
	"source_reference" text,
	"cost_price_usd" double precision,
	"quantity" integer,
	"status" "source_self_sourcing_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"ordered_at" timestamp,
	"expected_at" timestamp,
	"received_at" timestamp,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_self_sourcing" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_supplier_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_order_id" uuid NOT NULL,
	"customer_po_item_id" uuid NOT NULL,
	"quote_id" uuid,
	"product_name" text NOT NULL,
	"producer" text,
	"vintage" text,
	"region" text,
	"lwin7" text,
	"lwin18" text,
	"bottle_size" text,
	"case_config" integer,
	"quantity_cases" integer NOT NULL,
	"quantity_bottles" integer,
	"cost_per_bottle_usd" double precision,
	"cost_per_case_usd" double precision NOT NULL,
	"line_total_usd" double precision NOT NULL,
	"confirmation_status" "source_supplier_order_item_confirmation_status" DEFAULT 'pending' NOT NULL,
	"confirmed_at" timestamp,
	"updated_price_usd" double precision,
	"updated_quantity" integer,
	"update_reason" text,
	"rejection_reason" text,
	"partner_notes" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_supplier_order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_supplier_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_po_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"order_number" text NOT NULL,
	"status" "source_supplier_order_status" DEFAULT 'draft' NOT NULL,
	"item_count" integer DEFAULT 0,
	"total_amount_usd" double precision DEFAULT 0,
	"confirmed_amount_usd" double precision,
	"excel_file_url" text,
	"pdf_file_url" text,
	"sent_at" timestamp,
	"sent_by" uuid,
	"notified_at" timestamp,
	"viewed_at" timestamp,
	"confirmed_at" timestamp,
	"confirmed_by" uuid,
	"shipped_at" timestamp,
	"tracking_number" text,
	"delivered_at" timestamp,
	"admin_notes" text,
	"partner_notes" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "source_supplier_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
ALTER TABLE "source_supplier_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "wine_synonyms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical" text NOT NULL,
	"synonym" text NOT NULL,
	"type" "wine_synonym_type" NOT NULL,
	"confidence" double precision DEFAULT 1 NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wine_synonyms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "accounts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "passkeys" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verifications" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "passkeys" ADD COLUMN "aaguid" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "partner_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notification_preferences" jsonb;--> statement-breakpoint
ALTER TABLE "partner_contacts" ADD CONSTRAINT "partner_contacts_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_customer_po_items" ADD CONSTRAINT "source_customer_po_items_customer_po_id_source_customer_pos_id_fk" FOREIGN KEY ("customer_po_id") REFERENCES "public"."source_customer_pos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_customer_po_items" ADD CONSTRAINT "source_customer_po_items_matched_rfq_item_id_source_rfq_items_id_fk" FOREIGN KEY ("matched_rfq_item_id") REFERENCES "public"."source_rfq_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_customer_po_items" ADD CONSTRAINT "source_customer_po_items_matched_quote_id_source_rfq_quotes_id_fk" FOREIGN KEY ("matched_quote_id") REFERENCES "public"."source_rfq_quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_customer_pos" ADD CONSTRAINT "source_customer_pos_rfq_id_source_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."source_rfqs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_customer_pos" ADD CONSTRAINT "source_customer_pos_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_market_prices" ADD CONSTRAINT "source_market_prices_last_quoted_by_partners_id_fk" FOREIGN KEY ("last_quoted_by") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_partner_metrics" ADD CONSTRAINT "source_partner_metrics_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_purchase_order_items" ADD CONSTRAINT "source_purchase_order_items_po_id_source_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."source_purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_purchase_order_items" ADD CONSTRAINT "source_purchase_order_items_rfq_item_id_source_rfq_items_id_fk" FOREIGN KEY ("rfq_item_id") REFERENCES "public"."source_rfq_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_purchase_order_items" ADD CONSTRAINT "source_purchase_order_items_quote_id_source_rfq_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."source_rfq_quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_purchase_orders" ADD CONSTRAINT "source_purchase_orders_rfq_id_source_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."source_rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_purchase_orders" ADD CONSTRAINT "source_purchase_orders_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_purchase_orders" ADD CONSTRAINT "source_purchase_orders_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_purchase_orders" ADD CONSTRAINT "source_purchase_orders_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_purchase_orders" ADD CONSTRAINT "source_purchase_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_rfq_activity_logs" ADD CONSTRAINT "source_rfq_activity_logs_rfq_id_source_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."source_rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_rfq_activity_logs" ADD CONSTRAINT "source_rfq_activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_rfq_activity_logs" ADD CONSTRAINT "source_rfq_activity_logs_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_rfq_items" ADD CONSTRAINT "source_rfq_items_rfq_id_source_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."source_rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_rfq_items" ADD CONSTRAINT "source_rfq_items_selected_by_users_id_fk" FOREIGN KEY ("selected_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_rfq_items" ADD CONSTRAINT "source_rfq_items_price_adjusted_by_users_id_fk" FOREIGN KEY ("price_adjusted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_rfq_partner_contacts" ADD CONSTRAINT "source_rfq_partner_contacts_rfq_partner_id_source_rfq_partners_id_fk" FOREIGN KEY ("rfq_partner_id") REFERENCES "public"."source_rfq_partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_rfq_partner_contacts" ADD CONSTRAINT "source_rfq_partner_contacts_contact_id_partner_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."partner_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_rfq_partners" ADD CONSTRAINT "source_rfq_partners_rfq_id_source_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."source_rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_rfq_partners" ADD CONSTRAINT "source_rfq_partners_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_rfq_quotes" ADD CONSTRAINT "source_rfq_quotes_rfq_id_source_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."source_rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_rfq_quotes" ADD CONSTRAINT "source_rfq_quotes_item_id_source_rfq_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."source_rfq_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_rfq_quotes" ADD CONSTRAINT "source_rfq_quotes_rfq_partner_id_source_rfq_partners_id_fk" FOREIGN KEY ("rfq_partner_id") REFERENCES "public"."source_rfq_partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_rfq_quotes" ADD CONSTRAINT "source_rfq_quotes_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_rfqs" ADD CONSTRAINT "source_rfqs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_rfqs" ADD CONSTRAINT "source_rfqs_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_rfqs" ADD CONSTRAINT "source_rfqs_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_rfqs" ADD CONSTRAINT "source_rfqs_client_approved_by_users_id_fk" FOREIGN KEY ("client_approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_rfqs" ADD CONSTRAINT "source_rfqs_confirmation_requested_by_users_id_fk" FOREIGN KEY ("confirmation_requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_self_sourcing" ADD CONSTRAINT "source_self_sourcing_rfq_item_id_source_rfq_items_id_fk" FOREIGN KEY ("rfq_item_id") REFERENCES "public"."source_rfq_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_self_sourcing" ADD CONSTRAINT "source_self_sourcing_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_supplier_order_items" ADD CONSTRAINT "source_supplier_order_items_supplier_order_id_source_supplier_orders_id_fk" FOREIGN KEY ("supplier_order_id") REFERENCES "public"."source_supplier_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_supplier_order_items" ADD CONSTRAINT "source_supplier_order_items_customer_po_item_id_source_customer_po_items_id_fk" FOREIGN KEY ("customer_po_item_id") REFERENCES "public"."source_customer_po_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_supplier_order_items" ADD CONSTRAINT "source_supplier_order_items_quote_id_source_rfq_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."source_rfq_quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_supplier_orders" ADD CONSTRAINT "source_supplier_orders_customer_po_id_source_customer_pos_id_fk" FOREIGN KEY ("customer_po_id") REFERENCES "public"."source_customer_pos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_supplier_orders" ADD CONSTRAINT "source_supplier_orders_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_supplier_orders" ADD CONSTRAINT "source_supplier_orders_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_supplier_orders" ADD CONSTRAINT "source_supplier_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lwin_wines_country_idx" ON "lwin_wines" USING btree ("country");--> statement-breakpoint
CREATE INDEX "lwin_wines_region_idx" ON "lwin_wines" USING btree ("region");--> statement-breakpoint
CREATE INDEX "lwin_wines_colour_idx" ON "lwin_wines" USING btree ("colour");--> statement-breakpoint
CREATE INDEX "lwin_wines_status_idx" ON "lwin_wines" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lwin_wines_display_name_trigram_idx" ON "lwin_wines" USING gin ("display_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "lwin_wines_producer_name_trigram_idx" ON "lwin_wines" USING gin ("producer_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "lwin_wines_wine_trigram_idx" ON "lwin_wines" USING gin ("wine" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "lwin_wines_fts_idx" ON "lwin_wines" USING gin ((
        setweight(to_tsvector('english', coalesce("display_name", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("producer_name", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("wine", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("region", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("country", '')), 'C')
      ));--> statement-breakpoint
CREATE INDEX "partner_contacts_partner_id_idx" ON "partner_contacts" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "partner_contacts_email_idx" ON "partner_contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "source_customer_po_items_customer_po_id_idx" ON "source_customer_po_items" USING btree ("customer_po_id");--> statement-breakpoint
CREATE INDEX "source_customer_po_items_status_idx" ON "source_customer_po_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "source_customer_po_items_matched_quote_id_idx" ON "source_customer_po_items" USING btree ("matched_quote_id");--> statement-breakpoint
CREATE INDEX "source_customer_po_items_is_losing_item_idx" ON "source_customer_po_items" USING btree ("is_losing_item");--> statement-breakpoint
CREATE INDEX "source_customer_pos_status_idx" ON "source_customer_pos" USING btree ("status");--> statement-breakpoint
CREATE INDEX "source_customer_pos_rfq_id_idx" ON "source_customer_pos" USING btree ("rfq_id");--> statement-breakpoint
CREATE INDEX "source_customer_pos_created_at_idx" ON "source_customer_pos" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "source_market_prices_lwin_idx" ON "source_market_prices" USING btree ("lwin");--> statement-breakpoint
CREATE INDEX "source_partner_metrics_response_rate_idx" ON "source_partner_metrics" USING btree ("response_rate");--> statement-breakpoint
CREATE INDEX "source_partner_metrics_win_rate_idx" ON "source_partner_metrics" USING btree ("win_rate");--> statement-breakpoint
CREATE INDEX "source_purchase_order_items_po_id_idx" ON "source_purchase_order_items" USING btree ("po_id");--> statement-breakpoint
CREATE INDEX "source_purchase_order_items_rfq_item_id_idx" ON "source_purchase_order_items" USING btree ("rfq_item_id");--> statement-breakpoint
CREATE INDEX "source_purchase_order_items_status_idx" ON "source_purchase_order_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "source_purchase_orders_rfq_id_idx" ON "source_purchase_orders" USING btree ("rfq_id");--> statement-breakpoint
CREATE INDEX "source_purchase_orders_partner_id_idx" ON "source_purchase_orders" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "source_purchase_orders_status_idx" ON "source_purchase_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "source_purchase_orders_po_number_idx" ON "source_purchase_orders" USING btree ("po_number");--> statement-breakpoint
CREATE INDEX "source_rfq_activity_logs_rfq_id_idx" ON "source_rfq_activity_logs" USING btree ("rfq_id");--> statement-breakpoint
CREATE INDEX "source_rfq_activity_logs_created_at_idx" ON "source_rfq_activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "source_rfq_items_rfq_id_idx" ON "source_rfq_items" USING btree ("rfq_id");--> statement-breakpoint
CREATE INDEX "source_rfq_items_status_idx" ON "source_rfq_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "source_rfq_partner_contacts_rfq_partner_id_idx" ON "source_rfq_partner_contacts" USING btree ("rfq_partner_id");--> statement-breakpoint
CREATE INDEX "source_rfq_partner_contacts_contact_id_idx" ON "source_rfq_partner_contacts" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "source_rfq_partners_rfq_id_idx" ON "source_rfq_partners" USING btree ("rfq_id");--> statement-breakpoint
CREATE INDEX "source_rfq_partners_partner_id_idx" ON "source_rfq_partners" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "source_rfq_partners_status_idx" ON "source_rfq_partners" USING btree ("status");--> statement-breakpoint
CREATE INDEX "source_rfq_quotes_rfq_id_idx" ON "source_rfq_quotes" USING btree ("rfq_id");--> statement-breakpoint
CREATE INDEX "source_rfq_quotes_item_id_idx" ON "source_rfq_quotes" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "source_rfq_quotes_partner_id_idx" ON "source_rfq_quotes" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "source_rfq_quotes_is_selected_idx" ON "source_rfq_quotes" USING btree ("is_selected");--> statement-breakpoint
CREATE INDEX "source_rfq_quotes_confirmation_status_idx" ON "source_rfq_quotes" USING btree ("confirmation_status");--> statement-breakpoint
CREATE INDEX "source_rfqs_status_idx" ON "source_rfqs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "source_rfqs_created_at_idx" ON "source_rfqs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "source_rfqs_created_by_idx" ON "source_rfqs" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "source_self_sourcing_rfq_item_id_idx" ON "source_self_sourcing" USING btree ("rfq_item_id");--> statement-breakpoint
CREATE INDEX "source_self_sourcing_status_idx" ON "source_self_sourcing" USING btree ("status");--> statement-breakpoint
CREATE INDEX "source_self_sourcing_source_idx" ON "source_self_sourcing" USING btree ("source");--> statement-breakpoint
CREATE INDEX "source_supplier_order_items_supplier_order_id_idx" ON "source_supplier_order_items" USING btree ("supplier_order_id");--> statement-breakpoint
CREATE INDEX "source_supplier_order_items_customer_po_item_id_idx" ON "source_supplier_order_items" USING btree ("customer_po_item_id");--> statement-breakpoint
CREATE INDEX "source_supplier_order_items_confirmation_status_idx" ON "source_supplier_order_items" USING btree ("confirmation_status");--> statement-breakpoint
CREATE INDEX "source_supplier_orders_customer_po_id_idx" ON "source_supplier_orders" USING btree ("customer_po_id");--> statement-breakpoint
CREATE INDEX "source_supplier_orders_partner_id_idx" ON "source_supplier_orders" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "source_supplier_orders_status_idx" ON "source_supplier_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wine_synonyms_synonym_idx" ON "wine_synonyms" USING btree ("synonym");--> statement-breakpoint
CREATE INDEX "wine_synonyms_canonical_idx" ON "wine_synonyms" USING btree ("canonical");--> statement-breakpoint
CREATE INDEX "wine_synonyms_type_idx" ON "wine_synonyms" USING btree ("type");--> statement-breakpoint
CREATE INDEX "wine_synonyms_synonym_trigram_idx" ON "wine_synonyms" USING gin ("synonym" gin_trgm_ops);