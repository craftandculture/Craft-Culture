ALTER TYPE "public"."private_client_order_status" ADD VALUE 'awaiting_client_verification' BEFORE 'awaiting_client_payment';--> statement-breakpoint
ALTER TABLE "private_client_orders" ALTER COLUMN "partner_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "client_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "client_verified_by" uuid;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD COLUMN "client_verification_notes" text;--> statement-breakpoint
ALTER TABLE "private_client_orders" ADD CONSTRAINT "private_client_orders_client_verified_by_users_id_fk" FOREIGN KEY ("client_verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;