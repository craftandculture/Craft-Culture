CREATE TYPE "public"."logistics_invoice_status" AS ENUM('open', 'paid', 'overdue', 'disputed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."logistics_product_type" AS ENUM('wine', 'spirits', 'beer', 'mixed', 'other');--> statement-breakpoint
CREATE TYPE "public"."logistics_quote_request_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."logistics_quote_request_status" AS ENUM('pending', 'in_progress', 'quoted', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."logistics_quote_status" AS ENUM('draft', 'pending', 'accepted', 'rejected', 'expired');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'supplier_order_reminder';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'customer_po_received';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'customer_po_orders_generated';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'customer_po_ready';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'shipment_status_changed';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'document_expired';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'document_expiring_soon';--> statement-breakpoint
CREATE TABLE "logistics_invoice_shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"shipment_id" uuid NOT NULL,
	"allocated_amount" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "logistics_invoice_shipments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "logistics_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hillebrand_invoice_id" integer,
	"hillebrand_last_sync" timestamp,
	"invoice_number" text NOT NULL,
	"invoice_date" timestamp NOT NULL,
	"payment_due_date" timestamp,
	"status" "logistics_invoice_status" DEFAULT 'open' NOT NULL,
	"currency_code" text DEFAULT 'USD' NOT NULL,
	"total_amount" double precision NOT NULL,
	"open_amount" double precision NOT NULL,
	"paid_amount" double precision DEFAULT 0,
	"paid_at" timestamp,
	"payment_reference" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "logistics_invoices_hillebrand_invoice_id_unique" UNIQUE("hillebrand_invoice_id")
);
--> statement-breakpoint
ALTER TABLE "logistics_invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "logistics_quote_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"unit_price" double precision,
	"quantity" integer DEFAULT 1,
	"total" double precision NOT NULL,
	"currency" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "logistics_quote_line_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "logistics_quote_request_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"description" text,
	"uploaded_by" uuid,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "logistics_quote_request_attachments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "logistics_quote_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_number" text NOT NULL,
	"status" "logistics_quote_request_status" DEFAULT 'pending' NOT NULL,
	"priority" "logistics_quote_request_priority" DEFAULT 'normal' NOT NULL,
	"requested_by" uuid NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"assigned_to" uuid,
	"assigned_at" timestamp,
	"origin_country" text NOT NULL,
	"origin_city" text,
	"origin_warehouse" text,
	"destination_country" text NOT NULL,
	"destination_city" text,
	"destination_warehouse" text,
	"transport_mode" "logistics_transport_mode",
	"product_type" "logistics_product_type" DEFAULT 'wine' NOT NULL,
	"product_description" text,
	"total_cases" integer,
	"total_pallets" integer,
	"total_weight_kg" double precision,
	"total_volume_m3" double precision,
	"requires_thermal_liner" boolean DEFAULT false NOT NULL,
	"requires_tracker" boolean DEFAULT false NOT NULL,
	"requires_insurance" boolean DEFAULT false NOT NULL,
	"temperature_controlled" boolean DEFAULT false NOT NULL,
	"min_temperature" double precision,
	"max_temperature" double precision,
	"target_pickup_date" timestamp,
	"target_delivery_date" timestamp,
	"is_flexible_dates" boolean DEFAULT true NOT NULL,
	"notes" text,
	"internal_notes" text,
	"completed_at" timestamp,
	"completed_by" uuid,
	"cancellation_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "logistics_quote_requests_request_number_unique" UNIQUE("request_number")
);
--> statement-breakpoint
ALTER TABLE "logistics_quote_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "logistics_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_number" text NOT NULL,
	"forwarder_name" text NOT NULL,
	"forwarder_contact" text,
	"forwarder_email" text,
	"shipment_id" uuid,
	"request_id" uuid,
	"origin_country" text,
	"origin_city" text,
	"destination_country" text,
	"destination_city" text,
	"transport_mode" "logistics_transport_mode",
	"total_price" double precision NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"transit_days" integer,
	"valid_from" timestamp,
	"valid_until" timestamp,
	"status" "logistics_quote_status" DEFAULT 'pending' NOT NULL,
	"accepted_at" timestamp,
	"accepted_by" uuid,
	"rejected_at" timestamp,
	"rejected_by" uuid,
	"rejection_reason" text,
	"notes" text,
	"internal_notes" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "logistics_quotes_quote_number_unique" UNIQUE("quote_number")
);
--> statement-breakpoint
ALTER TABLE "logistics_quotes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "logistics_documents" ALTER COLUMN "uploaded_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "logistics_documents" ADD COLUMN "hillebrand_document_id" integer;--> statement-breakpoint
ALTER TABLE "logistics_documents" ADD COLUMN "hillebrand_download_url" text;--> statement-breakpoint
ALTER TABLE "logistics_documents" ADD COLUMN "hillebrand_last_sync" timestamp;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "finance_email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "banned" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ban_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ban_expires" timestamp;--> statement-breakpoint
ALTER TABLE "logistics_invoice_shipments" ADD CONSTRAINT "logistics_invoice_shipments_invoice_id_logistics_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."logistics_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_invoice_shipments" ADD CONSTRAINT "logistics_invoice_shipments_shipment_id_logistics_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."logistics_shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_quote_line_items" ADD CONSTRAINT "logistics_quote_line_items_quote_id_logistics_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."logistics_quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_quote_request_attachments" ADD CONSTRAINT "logistics_quote_request_attachments_request_id_logistics_quote_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."logistics_quote_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_quote_request_attachments" ADD CONSTRAINT "logistics_quote_request_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_quote_requests" ADD CONSTRAINT "logistics_quote_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_quote_requests" ADD CONSTRAINT "logistics_quote_requests_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_quote_requests" ADD CONSTRAINT "logistics_quote_requests_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_quotes" ADD CONSTRAINT "logistics_quotes_shipment_id_logistics_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."logistics_shipments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_quotes" ADD CONSTRAINT "logistics_quotes_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_quotes" ADD CONSTRAINT "logistics_quotes_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_quotes" ADD CONSTRAINT "logistics_quotes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "logistics_invoice_shipments_invoice_id_idx" ON "logistics_invoice_shipments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "logistics_invoice_shipments_shipment_id_idx" ON "logistics_invoice_shipments" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "logistics_invoices_invoice_number_idx" ON "logistics_invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "logistics_invoices_status_idx" ON "logistics_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "logistics_invoices_hillebrand_id_idx" ON "logistics_invoices" USING btree ("hillebrand_invoice_id");--> statement-breakpoint
CREATE INDEX "logistics_invoices_invoice_date_idx" ON "logistics_invoices" USING btree ("invoice_date");--> statement-breakpoint
CREATE INDEX "logistics_quote_line_items_quote_id_idx" ON "logistics_quote_line_items" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "logistics_quote_request_attachments_request_id_idx" ON "logistics_quote_request_attachments" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "logistics_quote_requests_request_number_idx" ON "logistics_quote_requests" USING btree ("request_number");--> statement-breakpoint
CREATE INDEX "logistics_quote_requests_status_idx" ON "logistics_quote_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "logistics_quote_requests_requested_by_idx" ON "logistics_quote_requests" USING btree ("requested_by");--> statement-breakpoint
CREATE INDEX "logistics_quote_requests_assigned_to_idx" ON "logistics_quote_requests" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "logistics_quote_requests_priority_idx" ON "logistics_quote_requests" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "logistics_quotes_quote_number_idx" ON "logistics_quotes" USING btree ("quote_number");--> statement-breakpoint
CREATE INDEX "logistics_quotes_shipment_id_idx" ON "logistics_quotes" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "logistics_quotes_request_id_idx" ON "logistics_quotes" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "logistics_quotes_status_idx" ON "logistics_quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "logistics_quotes_forwarder_idx" ON "logistics_quotes" USING btree ("forwarder_name");--> statement-breakpoint
CREATE INDEX "logistics_quotes_valid_until_idx" ON "logistics_quotes" USING btree ("valid_until");--> statement-breakpoint
ALTER TABLE "logistics_documents" ADD CONSTRAINT "logistics_documents_hillebrand_document_id_unique" UNIQUE("hillebrand_document_id");