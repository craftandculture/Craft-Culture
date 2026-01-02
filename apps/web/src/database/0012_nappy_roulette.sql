ALTER TABLE "private_client_order_activity_logs" ALTER COLUMN "previous_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "private_client_order_activity_logs" ALTER COLUMN "new_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "private_client_orders" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "private_client_orders" ALTER COLUMN "status" SET DEFAULT 'draft'::text;--> statement-breakpoint
DROP TYPE "public"."private_client_order_status";--> statement-breakpoint
CREATE TYPE "public"."private_client_order_status" AS ENUM('draft', 'submitted', 'under_cc_review', 'revision_requested', 'cc_approved', 'awaiting_partner_verification', 'awaiting_distributor_verification', 'verification_suspended', 'awaiting_client_payment', 'client_paid', 'awaiting_distributor_payment', 'distributor_paid', 'awaiting_partner_payment', 'partner_paid', 'stock_in_transit', 'with_distributor', 'out_for_delivery', 'delivered', 'cancelled');--> statement-breakpoint
ALTER TABLE "private_client_order_activity_logs" ALTER COLUMN "previous_status" SET DATA TYPE "public"."private_client_order_status" USING "previous_status"::"public"."private_client_order_status";--> statement-breakpoint
ALTER TABLE "private_client_order_activity_logs" ALTER COLUMN "new_status" SET DATA TYPE "public"."private_client_order_status" USING "new_status"::"public"."private_client_order_status";--> statement-breakpoint
ALTER TABLE "private_client_orders" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."private_client_order_status";--> statement-breakpoint
ALTER TABLE "private_client_orders" ALTER COLUMN "status" SET DATA TYPE "public"."private_client_order_status" USING "status"::"public"."private_client_order_status";--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "requires_client_verification" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "distributor_code" text;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "partner_verification_response" text;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "partner_verification_at" timestamp;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "partner_verification_by" uuid;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "distributor_verification_response" text;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "distributor_verification_at" timestamp;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "distributor_verification_by" uuid;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "distributor_verification_notes" text;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "payment_reference" text;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "partner_payment_notes" text;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "partner_payment_proof_url" text;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD CONSTRAINT "private_client_orders_partner_verification_by_users_id_fk" FOREIGN KEY ("partner_verification_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD CONSTRAINT "private_client_orders_distributor_verification_by_users_id_fk" FOREIGN KEY ("distributor_verification_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;