CREATE TYPE "public"."logistics_cost_allocation_method" AS ENUM('by_bottle', 'by_weight', 'by_value');--> statement-breakpoint
CREATE TYPE "public"."logistics_document_type" AS ENUM('bill_of_lading', 'airway_bill', 'commercial_invoice', 'packing_list', 'certificate_of_origin', 'customs_declaration', 'import_permit', 'export_permit', 'delivery_note', 'health_certificate', 'insurance_certificate', 'proof_of_delivery', 'other');--> statement-breakpoint
CREATE TYPE "public"."logistics_shipment_status" AS ENUM('draft', 'booked', 'picked_up', 'in_transit', 'arrived_port', 'customs_clearance', 'cleared', 'at_warehouse', 'dispatched', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."logistics_shipment_type" AS ENUM('inbound', 'outbound', 're_export');--> statement-breakpoint
CREATE TYPE "public"."logistics_transport_mode" AS ENUM('sea_fcl', 'sea_lcl', 'air', 'road');--> statement-breakpoint
CREATE TABLE "logistics_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"document_type" "logistics_document_type" NOT NULL,
	"document_number" text,
	"file_url" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"issue_date" timestamp,
	"expiry_date" timestamp,
	"is_required" boolean DEFAULT false NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp,
	"uploaded_by" uuid NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"extraction_status" "document_extraction_status" DEFAULT 'pending' NOT NULL,
	"extracted_data" jsonb,
	"extraction_error" text,
	"extracted_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"previous_version_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "logistics_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "logistics_rate_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"transport_mode" "logistics_transport_mode",
	"origin_country" text,
	"destination_warehouse" text,
	"rate_type" text NOT NULL,
	"rate_amount_aed" double precision NOT NULL,
	"rate_amount_usd" double precision,
	"currency" text DEFAULT 'AED' NOT NULL,
	"container_size" text,
	"valid_from" timestamp,
	"valid_to" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "logistics_rate_cards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "logistics_shipment_activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"user_id" uuid,
	"partner_id" uuid,
	"action" text NOT NULL,
	"previous_status" "logistics_shipment_status",
	"new_status" "logistics_shipment_status",
	"metadata" jsonb,
	"notes" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "logistics_shipment_activity_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "logistics_shipment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name" text NOT NULL,
	"producer" text,
	"vintage" integer,
	"region" text,
	"country_of_origin" text,
	"hs_code" text,
	"cases" integer NOT NULL,
	"bottles_per_case" integer DEFAULT 12,
	"bottle_size_ml" integer DEFAULT 750,
	"total_bottles" integer,
	"gross_weight_kg" double precision,
	"net_weight_kg" double precision,
	"declared_value_usd" double precision,
	"product_cost_per_bottle" double precision,
	"freight_allocated" double precision,
	"handling_allocated" double precision,
	"gov_fees_allocated" double precision,
	"insurance_allocated" double precision,
	"landed_cost_total" double precision,
	"landed_cost_per_bottle" double precision,
	"target_selling_price" double precision,
	"margin_per_bottle" double precision,
	"margin_percent" double precision,
	"notes" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "logistics_shipment_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "logistics_shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_number" text NOT NULL,
	"type" "logistics_shipment_type" NOT NULL,
	"transport_mode" "logistics_transport_mode" NOT NULL,
	"status" "logistics_shipment_status" DEFAULT 'draft' NOT NULL,
	"partner_id" uuid,
	"client_contact_id" uuid,
	"origin_country" text,
	"origin_city" text,
	"origin_warehouse" text,
	"destination_country" text,
	"destination_city" text,
	"destination_warehouse" text DEFAULT 'RAK Port',
	"carrier_name" text,
	"carrier_booking_ref" text,
	"container_number" text,
	"bl_number" text,
	"awb_number" text,
	"hillebrand_shipment_id" integer,
	"hillebrand_reference" text,
	"hillebrand_last_sync" timestamp,
	"etd" timestamp,
	"atd" timestamp,
	"eta" timestamp,
	"ata" timestamp,
	"delivered_at" timestamp,
	"total_cases" integer DEFAULT 0,
	"total_bottles" integer DEFAULT 0,
	"total_weight_kg" double precision,
	"total_volume_m3" double precision,
	"freight_cost_usd" double precision,
	"insurance_cost_usd" double precision,
	"origin_handling_usd" double precision,
	"destination_handling_usd" double precision,
	"customs_clearance_usd" double precision,
	"gov_fees_usd" double precision,
	"delivery_cost_usd" double precision,
	"other_costs_usd" double precision,
	"total_landed_cost_usd" double precision,
	"cost_allocation_method" "logistics_cost_allocation_method" DEFAULT 'by_bottle',
	"co2_emissions_tonnes" double precision,
	"internal_notes" text,
	"partner_notes" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "logistics_shipments_shipment_number_unique" UNIQUE("shipment_number")
);
--> statement-breakpoint
ALTER TABLE "logistics_shipments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "logistics_documents" ADD CONSTRAINT "logistics_documents_shipment_id_logistics_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."logistics_shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_documents" ADD CONSTRAINT "logistics_documents_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_documents" ADD CONSTRAINT "logistics_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_rate_cards" ADD CONSTRAINT "logistics_rate_cards_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_shipment_activity_logs" ADD CONSTRAINT "logistics_shipment_activity_logs_shipment_id_logistics_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."logistics_shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_shipment_activity_logs" ADD CONSTRAINT "logistics_shipment_activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_shipment_activity_logs" ADD CONSTRAINT "logistics_shipment_activity_logs_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_shipment_items" ADD CONSTRAINT "logistics_shipment_items_shipment_id_logistics_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."logistics_shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_shipment_items" ADD CONSTRAINT "logistics_shipment_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_shipments" ADD CONSTRAINT "logistics_shipments_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_shipments" ADD CONSTRAINT "logistics_shipments_client_contact_id_private_client_contacts_id_fk" FOREIGN KEY ("client_contact_id") REFERENCES "public"."private_client_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_shipments" ADD CONSTRAINT "logistics_shipments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "logistics_documents_shipment_id_idx" ON "logistics_documents" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "logistics_documents_document_type_idx" ON "logistics_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "logistics_documents_extraction_status_idx" ON "logistics_documents" USING btree ("extraction_status");--> statement-breakpoint
CREATE INDEX "logistics_documents_expiry_date_idx" ON "logistics_documents" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "logistics_rate_cards_transport_mode_idx" ON "logistics_rate_cards" USING btree ("transport_mode");--> statement-breakpoint
CREATE INDEX "logistics_rate_cards_destination_warehouse_idx" ON "logistics_rate_cards" USING btree ("destination_warehouse");--> statement-breakpoint
CREATE INDEX "logistics_rate_cards_is_active_idx" ON "logistics_rate_cards" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "logistics_shipment_activity_logs_shipment_id_idx" ON "logistics_shipment_activity_logs" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "logistics_shipment_activity_logs_user_id_idx" ON "logistics_shipment_activity_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "logistics_shipment_activity_logs_created_at_idx" ON "logistics_shipment_activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "logistics_shipment_activity_logs_action_idx" ON "logistics_shipment_activity_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "logistics_shipment_items_shipment_id_idx" ON "logistics_shipment_items" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "logistics_shipment_items_product_id_idx" ON "logistics_shipment_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "logistics_shipments_shipment_number_idx" ON "logistics_shipments" USING btree ("shipment_number");--> statement-breakpoint
CREATE INDEX "logistics_shipments_partner_id_idx" ON "logistics_shipments" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "logistics_shipments_client_contact_id_idx" ON "logistics_shipments" USING btree ("client_contact_id");--> statement-breakpoint
CREATE INDEX "logistics_shipments_status_idx" ON "logistics_shipments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "logistics_shipments_type_idx" ON "logistics_shipments" USING btree ("type");--> statement-breakpoint
CREATE INDEX "logistics_shipments_hillebrand_id_idx" ON "logistics_shipments" USING btree ("hillebrand_shipment_id");