ALTER TYPE "public"."user_role" ADD VALUE 'wms_operator';--> statement-breakpoint
CREATE TABLE "wms_owner_pricing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lwin18" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"pc_selling_price_per_bottle" double precision NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wms_owner_pricing" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "wms_product_pricing" ADD COLUMN "selling_price_per_bottle" double precision;--> statement-breakpoint
ALTER TABLE "wms_owner_pricing" ADD CONSTRAINT "wms_owner_pricing_owner_id_partners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_owner_pricing" ADD CONSTRAINT "wms_owner_pricing_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wms_owner_pricing_lwin18_owner_idx" ON "wms_owner_pricing" USING btree ("lwin18","owner_id");--> statement-breakpoint
CREATE INDEX "wms_owner_pricing_owner_id_idx" ON "wms_owner_pricing" USING btree ("owner_id");