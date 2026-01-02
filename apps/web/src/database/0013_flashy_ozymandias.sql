ALTER TYPE "public"."notification_type" ADD VALUE 'action_required';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'po_assigned';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'status_update';--> statement-breakpoint
ALTER TYPE "public"."private_client_order_status" ADD VALUE 'scheduling_delivery' BEFORE 'stock_in_transit';--> statement-breakpoint
ALTER TYPE "public"."private_client_order_status" ADD VALUE 'delivery_scheduled' BEFORE 'stock_in_transit';--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "partner_invoice_acknowledged_at" timestamp;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "partner_invoice_acknowledged_by" uuid;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "scheduled_delivery_date" timestamp;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "scheduled_delivery_at" timestamp;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "scheduled_delivery_by" uuid;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "delivery_contact_attempts" jsonb;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "delivery_signature" text;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "delivery_photo" text;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD CONSTRAINT "private_client_orders_partner_invoice_acknowledged_by_users_id_fk" FOREIGN KEY ("partner_invoice_acknowledged_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD CONSTRAINT "private_client_orders_scheduled_delivery_by_users_id_fk" FOREIGN KEY ("scheduled_delivery_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;