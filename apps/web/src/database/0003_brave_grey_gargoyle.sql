ALTER TYPE "public"."quote_status" ADD VALUE 'buy_request_submitted';--> statement-breakpoint
ALTER TYPE "public"."quote_status" ADD VALUE 'under_cc_review';--> statement-breakpoint
ALTER TYPE "public"."quote_status" ADD VALUE 'revision_requested';--> statement-breakpoint
ALTER TYPE "public"."quote_status" ADD VALUE 'cc_confirmed';--> statement-breakpoint
ALTER TYPE "public"."quote_status" ADD VALUE 'po_submitted';--> statement-breakpoint
ALTER TYPE "public"."quote_status" ADD VALUE 'po_confirmed';--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "acceptance_notes" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "accepted_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "buy_request_submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "buy_request_submitted_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "buy_request_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "cc_review_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "cc_reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "cc_notes" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "revision_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "revision_requested_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "revision_reason" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "revision_suggestions" jsonb;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "revision_history" jsonb;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "cc_confirmed_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "cc_confirmed_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "cc_confirmation_notes" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "po_number" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "po_submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "po_submitted_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "po_attachment_url" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "po_confirmed_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "po_confirmed_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "po_confirmation_notes" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "company_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "company_logo" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "company_address" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "company_phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "company_email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "company_website" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "company_vat_number" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_buy_request_submitted_by_users_id_fk" FOREIGN KEY ("buy_request_submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_cc_reviewed_by_users_id_fk" FOREIGN KEY ("cc_reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_revision_requested_by_users_id_fk" FOREIGN KEY ("revision_requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_cc_confirmed_by_users_id_fk" FOREIGN KEY ("cc_confirmed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_po_submitted_by_users_id_fk" FOREIGN KEY ("po_submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_po_confirmed_by_users_id_fk" FOREIGN KEY ("po_confirmed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;